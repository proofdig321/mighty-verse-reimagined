"use client";

import { useEffect, useRef } from "react";
import type { HolographicLayer } from "@/lib/media/sentinel-intelligence";
import { audienceLayerTitle, layerIsActive } from "@/lib/experience/holographic-program";
import type { HolographicAudioGraph } from "@/lib/experience/holographic-spatial-audio";
import {
  HOLOGRAPHIC_MESH_SEGMENTS,
  HOLOGRAPHIC_PARALLAX_STRENGTH,
  holographicMouseUv,
  holographicPanFromPointerX,
  lerp,
  tessellatePlane,
  tessellateVertexCount,
  type TheaterPointer,
} from "@/lib/experience/holographic-warp";

export type { TheaterPointer };

const STILL_VERT = `
attribute vec3 a_pos;
attribute vec2 a_uv;
uniform mat4 u_mvp;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = u_mvp * vec4(a_pos, 1.0);
}
`;

const STILL_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_alpha;
uniform vec3 u_tint;
void main() {
  vec4 color = texture2D(u_tex, v_uv);
  gl_FragColor = vec4(color.rgb * u_tint, color.a * u_alpha);
}
`;

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
  pos.x -= delta.x * wave * u_parallax * 1.8;
  pos.y -= delta.y * wave * u_parallax * 1.0;
  pos.z += wave * delta.x * 2.2;
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

function createQuad(gl: WebGLRenderingContext) {
  return createBuffer(
    gl,
    new Float32Array([
      -1, -1, 0, 0, 1,
      1, -1, 0, 1, 1,
      -1, 1, 0, 0, 0,
      -1, 1, 0, 0, 0,
      1, -1, 0, 1, 1,
      1, 1, 0, 1, 0,
    ]),
  );
}

function emptyTexture(gl: WebGLRenderingContext) {
  const texture = gl.createTexture();
  if (!texture) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([5, 5, 8, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function canvasTexture(gl: WebGLRenderingContext, title: string, still: HTMLImageElement | null) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = still ? 480 : 768;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#0b0b12";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (still && still.naturalWidth > 0) {
    ctx.drawImage(still, 0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(0, canvas.height - 72, canvas.width, 72);
  }
  ctx.fillStyle = "#f4f0ea";
  ctx.font = "600 42px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(title, 28, still ? canvas.height - 36 : canvas.height / 2);
  const texture = gl.createTexture();
  if (!texture) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
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
  const timeRef = useRef(timeMs);
  const layersRef = useRef(layers);
  const signature = layers.map((layer) => `${layer.layer_id}:${layer.still_url ?? ""}`).join("|");

  useEffect(() => {
    timeRef.current = timeMs;
  }, [timeMs]);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

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
    const stillProgram = createProgram(gl, STILL_VERT, STILL_FRAG);
    const videoProgram = createProgram(gl, VIDEO_VERT, VIDEO_FRAG);
    const quad = createQuad(gl);
    const mesh = createBuffer(gl, tessellatePlane(HOLOGRAPHIC_MESH_SEGMENTS));
    const meshCount = tessellateVertexCount(HOLOGRAPHIC_MESH_SEGMENTS);
    const videoTexture = emptyTexture(gl);
    if (!stillProgram || !videoProgram || !quad || !mesh || !videoTexture) {
      surface.dataset.holographicTheater = "unavailable";
      return;
    }
    const warpProgram: WebGLProgram = videoProgram;
    const overlayProgram: WebGLProgram = stillProgram;
    const meshBuffer: WebGLBuffer = mesh;
    const quadBuffer: WebGLBuffer = quad;
    surface.dataset.holographicTheater = "webgl";

    const stillPos = gl.getAttribLocation(overlayProgram, "a_pos");
    const stillUv = gl.getAttribLocation(overlayProgram, "a_uv");
    const stillMvp = gl.getUniformLocation(overlayProgram, "u_mvp");
    const stillAlpha = gl.getUniformLocation(overlayProgram, "u_alpha");
    const stillTint = gl.getUniformLocation(overlayProgram, "u_tint");

    const videoPos = gl.getAttribLocation(warpProgram, "a_pos");
    const videoUv = gl.getAttribLocation(warpProgram, "a_uv");
    const videoMvp = gl.getUniformLocation(warpProgram, "u_mvp");
    const videoMouse = gl.getUniformLocation(warpProgram, "u_mouse");
    const videoParallax = gl.getUniformLocation(warpProgram, "u_parallax");
    const videoTime = gl.getUniformLocation(warpProgram, "u_time");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    let cancelled = false;
    const textures = new Map<string, WebGLTexture>();
    const mouse = { x: 0.5, y: 0.5 };
    const started = performance.now();

    async function loadTextures() {
      for (const layer of layersRef.current) {
        if (cancelled) return;
        const title = audienceLayerTitle(layer.title, layer.kind === "moment" ? "Creative Moment" : "Scene");
        const still = layer.still_url ? await loadImage(layer.still_url) : null;
        if (cancelled) return;
        const texture = canvasTexture(gl, title, still);
        if (texture) textures.set(layer.layer_id, texture);
      }
    }

    void loadTextures();

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

      const view = viewOffset((mouse.x - 0.5) * 0.35, (mouse.y - 0.5) * 0.22, cameraZ);
      const vp = mat4Multiply(proj, view);

      const video =
        videoRef?.current ??
        (surface.parentElement?.querySelector("[data-holographic-kind='mural'] video") as HTMLVideoElement | null);
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        try {
          gl.bindTexture(gl.TEXTURE_2D, videoTexture);
          // Video UV origin is top-left. Keep UNPACK_FLIP_Y off so Mux frames
          // stay right-side up. Do not invert the mesh or vertex math.
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
          const glError = gl.getError();
          surface.dataset.holographicWarp = glError === gl.NO_ERROR ? "live" : "blocked";
        } catch {
          surface.dataset.holographicWarp = "blocked";
        }
      } else {
        surface.dataset.holographicWarp = video ? "waiting" : "novideo";
      }

      const viewH = 2 * Math.tan(fov / 2) * cameraZ;
      const viewW = viewH * aspect;
      const videoAspect = video && video.videoWidth > 0 ? video.videoWidth / video.videoHeight : 16 / 9;
      let planeW = viewW * 0.94;
      let planeH = planeW / videoAspect;
      if (planeH > viewH * 0.94) {
        planeH = viewH * 0.94;
        planeW = planeH * videoAspect;
      }

      bindMesh(gl, warpProgram, meshBuffer, videoPos, videoUv);
      gl.uniformMatrix4fv(videoMvp, false, mat4Multiply(vp, mat4Multiply(translation(0, 0, 0.15), scaleMat(planeW / 2, planeH / 2, 1))));
      gl.uniform2f(videoMouse, mouse.x, mouse.y);
      gl.uniform1f(videoParallax, HOLOGRAPHIC_PARALLAX_STRENGTH);
      gl.uniform1f(videoTime, (performance.now() - started) / 1000);
      gl.bindTexture(gl.TEXTURE_2D, videoTexture);
      gl.drawArrays(gl.TRIANGLES, 0, meshCount);

      bindMesh(gl, overlayProgram, quadBuffer, stillPos, stillUv);
      const spatial = layersRef.current.filter((layer) => layer.kind === "scene" || layer.kind === "moment");
      spatial.forEach((layer, index) => {
        const texture = textures.get(layer.layer_id);
        if (!texture) return;
        const active = layerIsActive(layer, timeRef.current);
        const isMoment = layer.kind === "moment";
        const spread = spatial.filter((entry) => entry.kind === layer.kind);
        const kindIndex = spread.findIndex((entry) => entry.layer_id === layer.layer_id);
        const x = (kindIndex - (spread.length - 1) / 2) * (isMoment ? 1.55 : 1.85);
        const y = isMoment ? 0.95 : -0.35;
        const z = active ? -1.15 : -2.1 - index * 0.08;
        const width = isMoment ? 0.72 : 1.15;
        const height = isMoment ? 0.92 : 0.64;
        const model = mat4Multiply(translation(x, y, z), scaleMat(width * (active ? 1.12 : 1), height * (active ? 1.12 : 1), 1));
        gl.uniformMatrix4fv(stillMvp, false, mat4Multiply(vp, model));
        gl.uniform1f(stillAlpha, active ? 0.72 : 0.28);
        gl.uniform3f(stillTint, active ? 1 : 0.72, active ? 1 : 0.78, active ? 1 : 0.86);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      });
      frame = window.requestAnimationFrame(draw);
    }

    frame = window.requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      textures.forEach((texture) => gl.deleteTexture(texture));
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
