"use client";

import { useEffect, useRef } from "react";
import type { HolographicLayer } from "@/lib/media/sentinel-intelligence";
import type { HolographicAudioGraph } from "@/lib/experience/holographic-spatial-audio";
import {
  HOLOGRAPHIC_CINEMA_FILL,
  HOLOGRAPHIC_MESH_SEGMENTS,
  HOLOGRAPHIC_PARALLAX_STRENGTH,
  HOLOGRAPHIC_VIDEO_TEXTURE_FLIP_Y,
  holographicCinemaPlane,
  holographicMouseUv,
  holographicPanFromPointerX,
  lerp,
  muxVideoTextureUpdate,
  tessellatePlane,
  tessellateVertexCount,
  type TheaterPointer,
} from "@/lib/experience/holographic-warp";

export type { TheaterPointer };

const VIDEO_VERT = `
precision mediump float;
attribute vec3 a_pos;
attribute vec2 a_uv;
uniform mat4 u_mvp;
uniform vec2 u_mouse;
uniform float u_parallax;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  vec3 pos = a_pos;
  float wave = sin(a_uv.x * 3.1415926) * sin(a_uv.y * 3.1415926);
  vec2 delta = u_mouse - vec2(0.5);
  pos.x -= delta.x * wave * u_parallax;
  pos.y -= delta.y * wave * u_parallax * 0.6;
  pos.z += wave * delta.x * 0.4;
  gl_Position = u_mvp * vec4(pos, 1.0);
}
`;

const VIDEO_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_mouse;
uniform float u_time;
void main() {
  vec2 delta = u_mouse - vec2(0.5);
  vec2 rOffset = delta * 0.025;
  vec2 bOffset = -delta * 0.025;
  float r = texture2D(u_tex, clamp(v_uv + rOffset, 0.0, 1.0)).r;
  float g = texture2D(u_tex, v_uv).g;
  float b = texture2D(u_tex, clamp(v_uv + bOffset, 0.0, 1.0)).b;
  float scanline = sin(v_uv.y * 600.0 + u_time * 8.0) * 0.06;
  float edgeGlow = smoothstep(0.0, 0.5, abs(v_uv.x - 0.5)) * 0.05;
  vec3 color = vec3(r, g, b) + scanline + vec3(edgeGlow, 0.0, edgeGlow * 2.0);
  gl_FragColor = vec4(color, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function mat4Identity(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 4; j += 1) {
      out[j * 4 + i] =
        a[i] * b[j * 4] +
        a[4 + i] * b[j * 4 + 1] +
        a[8 + i] * b[j * 4 + 2] +
        a[12 + i] * b[j * 4 + 3];
    }
  }
  return out;
}

function perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

function viewOffset(x: number, y: number, z: number): Float32Array {
  const out = mat4Identity();
  out[12] = -x;
  out[13] = -y;
  out[14] = -z;
  return out;
}

function translation(x: number, y: number, z: number): Float32Array {
  const out = mat4Identity();
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

function scaleMat(x: number, y: number, z: number): Float32Array {
  const out = mat4Identity();
  out[0] = x;
  out[5] = y;
  out[10] = z;
  return out;
}

function createProgram(gl: WebGLRenderingContext, vertSrc: string, fragSrc: string) {
  const vs = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  return program;
}

function createBuffer(gl: WebGLRenderingContext, data: Float32Array) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

/**
 * Mux video → GPU unpack. Same contract as Three.js:
 * `texture.flipY = false` + sRGB / browser default color conversion.
 * Do not invert the mesh or vertex math to correct orientation.
 */
function bindVideoTextureUnpack(gl: WebGLRenderingContext) {
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, HOLOGRAPHIC_VIDEO_TEXTURE_FLIP_Y ? 1 : 0);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
}

function emptyTexture(gl: WebGLRenderingContext) {
  const texture = gl.createTexture();
  if (!texture) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  bindVideoTextureUnpack(gl);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function bindMesh(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  buffer: WebGLBuffer,
  pos: number,
  uv: number,
) {
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(uv);
  gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 20, 12);
}

export function HolographicTheater({
  layers,
  timeMs,
  pointerRef,
  videoRef,
  audioRef,
}: {
  layers: HolographicLayer[];
  timeMs: number;
  pointerRef: { current: TheaterPointer };
  videoRef?: { current: HTMLVideoElement | null };
  audioRef?: { current: HolographicAudioGraph | null };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signature = layers.map((layer) => `${layer.layer_id}:${layer.still_url ?? ""}`).join("|");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const glContext = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    });
    if (!glContext) {
      canvas.dataset.holographicTheater = "unavailable";
      return;
    }
    const gl: WebGLRenderingContext = glContext;
    const surface: HTMLCanvasElement = canvas;
    const videoProgram = createProgram(gl, VIDEO_VERT, VIDEO_FRAG);
    const mesh = createBuffer(gl, tessellatePlane(HOLOGRAPHIC_MESH_SEGMENTS));
    const meshCount = tessellateVertexCount(HOLOGRAPHIC_MESH_SEGMENTS);
    const videoTexture = emptyTexture(gl);
    if (!videoProgram || !mesh || !videoTexture) {
      surface.dataset.holographicTheater = "unavailable";
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    bindVideoTextureUnpack(gl);
    surface.dataset.holographicFlipY = String(HOLOGRAPHIC_VIDEO_TEXTURE_FLIP_Y);
    surface.dataset.holographicParallax = HOLOGRAPHIC_PARALLAX_STRENGTH.toFixed(2);
    surface.dataset.holographicCinemaFill = String(HOLOGRAPHIC_CINEMA_FILL);
    surface.dataset.holographicOverlays = "none";
    const warpProgram: WebGLProgram = videoProgram;
    const meshBuffer: WebGLBuffer = mesh;
    surface.dataset.holographicTheater = "webgl";

    const videoPos = gl.getAttribLocation(warpProgram, "a_pos");
    const videoUv = gl.getAttribLocation(warpProgram, "a_uv");
    const videoMvp = gl.getUniformLocation(warpProgram, "u_mvp");
    const videoMouse = gl.getUniformLocation(warpProgram, "u_mouse");
    const videoParallax = gl.getUniformLocation(warpProgram, "u_parallax");
    const videoTime = gl.getUniformLocation(warpProgram, "u_time");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);

    let cancelled = false;
    const mouse = { x: 0.5, y: 0.5 };
    const started = performance.now();
    let allocatedWidth = 0;
    let allocatedHeight = 0;
    let texUploads = 0;
    let texSkips = 0;
    let draws = 0;

    let frame = 0;
    function resize() {
      const width = Math.max(1, Math.floor(surface.clientWidth * (window.devicePixelRatio || 1)));
      const height = Math.max(1, Math.floor(surface.clientHeight * (window.devicePixelRatio || 1)));
      if (surface.width !== width || surface.height !== height) {
        surface.width = width;
        surface.height = height;
      }
      gl.viewport(0, 0, surface.width, surface.height);
    }

    function draw() {
      if (cancelled) return;
      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const aspect = surface.width / Math.max(1, surface.height);
      const fov = (42 * Math.PI) / 180;
      const cameraZ = 6.35;
      const proj = perspective(fov, aspect, 0.1, 40);
      const look = pointerRef.current;
      const target = holographicMouseUv(look);
      mouse.x = lerp(mouse.x, target.x, 0.1);
      mouse.y = lerp(mouse.y, target.y, 0.1);
      audioRef?.current?.setPanFromPointerX(look.x);
      surface.dataset.holographicPan = holographicPanFromPointerX(look.x).toFixed(2);
      surface.dataset.holographicMouseX = mouse.x.toFixed(3);

      const view = viewOffset(0, 0, cameraZ);
      const vp = mat4Multiply(proj, view);

      const video =
        videoRef?.current ??
        (surface.parentElement?.querySelector("[data-holographic-kind='mural'] video") as HTMLVideoElement | null);
      if (!video) {
        surface.dataset.holographicWarp = "novideo";
      } else {
        const mode = muxVideoTextureUpdate({
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          allocatedWidth,
          allocatedHeight,
        });
        if (mode === "skip") {
          texSkips += 1;
          surface.dataset.holographicWarp = "waiting";
        } else {
          try {
            gl.bindTexture(gl.TEXTURE_2D, videoTexture);
            bindVideoTextureUnpack(gl);
            if (mode === "allocate") {
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
              allocatedWidth = video.videoWidth;
              allocatedHeight = video.videoHeight;
            } else {
              gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
            }
            texUploads += 1;
            surface.dataset.holographicTexPath = mode;
            const glError = gl.getError();
            if (glError !== gl.NO_ERROR && mode === "subimage") {
              allocatedWidth = 0;
              allocatedHeight = 0;
            }
            surface.dataset.holographicWarp = glError === gl.NO_ERROR ? "live" : "blocked";
          } catch {
            surface.dataset.holographicWarp = "blocked";
          }
        }
      }

      if (allocatedWidth > 0 && allocatedHeight > 0) {
        const viewH = 2 * Math.tan(fov / 2) * cameraZ;
        const viewW = viewH * aspect;
        const videoAspect = video && video.videoWidth > 0 ? video.videoWidth / video.videoHeight : 16 / 9;
        const { planeW, planeH } = holographicCinemaPlane(viewW, viewH, videoAspect);
        bindMesh(gl, warpProgram, meshBuffer, videoPos, videoUv);
        gl.uniformMatrix4fv(videoMvp, false, mat4Multiply(vp, mat4Multiply(translation(0, 0, 0.15), scaleMat(planeW / 2, planeH / 2, 1))));
        gl.uniform2f(videoMouse, mouse.x, mouse.y);
        gl.uniform1f(videoParallax, HOLOGRAPHIC_PARALLAX_STRENGTH);
        gl.uniform1f(videoTime, (performance.now() - started) / 1000);
        gl.bindTexture(gl.TEXTURE_2D, videoTexture);
        gl.drawArrays(gl.TRIANGLES, 0, meshCount);
      }

      draws += 1;
      surface.dataset.holographicDraws = String(draws);
      surface.dataset.holographicTexUploads = String(texUploads);
      surface.dataset.holographicTexSkips = String(texSkips);
      frame = window.requestAnimationFrame(draw);
    }

    frame = window.requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      gl.deleteTexture(videoTexture);
    };
  }, [signature, pointerRef, videoRef, audioRef]);

  return (
    <canvas
      ref={canvasRef}
      className="holographic-theater-webgl"
      data-holographic-theater="pending"
      aria-hidden="true"
    />
  );
}
