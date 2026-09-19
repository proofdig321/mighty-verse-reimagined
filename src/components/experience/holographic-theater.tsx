"use client";

import { useEffect, useRef } from "react";
import type { HolographicLayer } from "@/lib/media/sentinel-intelligence";
import type { HolographicAudioGraph } from "@/lib/experience/holographic-spatial-audio";
import type { ViewerPose } from "@/lib/experience/spatial-types";
import {
  HOLOGRAPHIC_CINEMA_FILL,
  HOLOGRAPHIC_MESH_SEGMENTS,
  HOLOGRAPHIC_PARALLAX_STRENGTH,
  HOLOGRAPHIC_VIDEO_TEXTURE_FLIP_Y,
  holographicCinemaPlane,
  holographicPanFromPointerX,
  holographicPoseUniforms,
  lerp,
  muxVideoTextureUpdate,
  tessellatePlane,
  tessellateVertexCount,
} from "@/lib/experience/holographic-warp";

export type { ViewerPose };

/**
 * Vertex shader — spatial renderer.
 *
 * Input boundary: u_viewer_x / u_viewer_y come from ViewerPose.position,
 * not from raw pointer coordinates. The shader does not know the input source.
 *
 * DEPTH MODEL:
 *   When u_has_depth = 0.0 (no real depth available):
 *     Runtime synthetic fallback — sine-wave envelope.
 *     wave = sin(u * π) × sin(v * π)
 *     This is content-blind. It is NOT a depth map.
 *     It is an explicit fallback, not the final spatial promise.
 *
 *   When u_has_depth = 1.0 (real depth texture present):
 *     depth = texture2D(u_depth, a_uv).r
 *     White (1.0) = near. Black (0.0) = far.
 *     Displacement scales with depth so near content moves more than far.
 *     [Future path — no real depth source exists yet.]
 *
 * PARALLAX SIGN CONVENTION (corrected):
 *   u_viewer_x > 0 (viewer right) → pos.x increases → content shifts right.
 *   This is the correct look-around direction.
 *   Previous implementation used -= which inverted the effect.
 *
 * DEPTH CONVENTION (for future depth texture):
 *   White (1.0) = near (foreground). Black (0.0) = far (background).
 *   Linear normalized values [0, 1]. No gamma correction on depth.
 *   Clamped to [0, 1] before displacement.
 */
const VIDEO_VERT = `
precision mediump float;
attribute vec3 a_pos;
attribute vec2 a_uv;
uniform mat4 u_mvp;
uniform float u_viewer_x;
uniform float u_viewer_y;
uniform float u_parallax;
uniform float u_has_depth;
uniform sampler2D u_depth;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  vec3 pos = a_pos;

  float wave;
  if (u_has_depth > 0.5) {
    // Real depth path: sample depth texture.
    // White = near (1.0), Black = far (0.0).
    // Near content displaces more than far content.
    wave = clamp(texture2D(u_depth, a_uv).r, 0.0, 1.0);
  } else {
    // Runtime synthetic fallback: sine-wave envelope.
    // Content-blind — peaks at UV center regardless of what is in the frame.
    // Explicitly NOT a depth map. Used only when no real depth is available.
    wave = sin(a_uv.x * 3.1415926) * sin(a_uv.y * 3.1415926);
  }

  // CORRECTED sign: viewer right (u_viewer_x > 0) → content shifts right.
  // += is the correct parallax direction (look-around effect).
  pos.x += u_viewer_x * wave * u_parallax;
  pos.y += u_viewer_y * wave * u_parallax * 0.6;
  pos.z += wave * u_viewer_x * 0.4;

  gl_Position = u_mvp * vec4(pos, 1.0);
}
`;

/**
 * Fragment shader.
 *
 * Chromatic aberration uses viewer position (not raw pointer) for consistency
 * with the vertex shader. Red shifts in the viewer direction, blue opposite —
 * simulating lens dispersion from the viewer's lateral position.
 *
 * Scanline and edge glow are stylistic holographic CRT effects.
 */
const VIDEO_FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_viewer_x;
uniform float u_viewer_y;
uniform float u_time;
void main() {
  vec2 viewerOffset = vec2(u_viewer_x, u_viewer_y);
  vec2 rOffset = viewerOffset * 0.025;
  vec2 bOffset = -viewerOffset * 0.025;
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

/**
 * HolographicTheater — the spatial WebGL renderer.
 *
 * Receives a ViewerPose from the input controller (via poseRef).
 * Does not interpret raw pointer coordinates.
 * Does not know whether the pose came from mouse, touch, or future XR.
 *
 * Depth is optional. When absent, the runtime_synthetic sine-wave fallback
 * is used. The shader has a clear path for real depth when it becomes available.
 *
 * The existing Mux video pipeline (HLS → HTMLVideoElement → texImage2D /
 * texSubImage2D) is fully preserved. The first-frame gate remains mandatory.
 */
export function HolographicTheater({
  layers,
  timeMs,
  poseRef,
  videoRef,
  audioRef,
}: {
  layers: HolographicLayer[];
  timeMs: number;
  /** ViewerPose ref from the input controller. Renderer reads this each frame. */
  poseRef: { current: ViewerPose };
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
    surface.dataset.holographicDepth = "runtime_synthetic";
    surface.dataset.holographicTheater = "webgl";

    const warpProgram: WebGLProgram = videoProgram;
    const meshBuffer: WebGLBuffer = mesh;

    const videoPos = gl.getAttribLocation(warpProgram, "a_pos");
    const videoUv = gl.getAttribLocation(warpProgram, "a_uv");
    const videoMvp = gl.getUniformLocation(warpProgram, "u_mvp");
    const uViewerX = gl.getUniformLocation(warpProgram, "u_viewer_x");
    const uViewerY = gl.getUniformLocation(warpProgram, "u_viewer_y");
    const videoParallax = gl.getUniformLocation(warpProgram, "u_parallax");
    const videoTime = gl.getUniformLocation(warpProgram, "u_time");
    const uHasDepth = gl.getUniformLocation(warpProgram, "u_has_depth");
    const uDepth = gl.getUniformLocation(warpProgram, "u_depth");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);

    let cancelled = false;
    // Smoothed viewer position — lerped toward the current pose each frame.
    const smoothed = { x: 0, y: 0 };
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

      // --- VIEW MODEL ---
      // Read the current ViewerPose from the input controller.
      // The renderer does not interpret raw pointer coordinates.
      const pose = poseRef.current;
      const uniforms = holographicPoseUniforms(pose);

      // Smooth the viewer position to avoid jitter.
      smoothed.x = lerp(smoothed.x, uniforms.viewerX, 0.1);
      smoothed.y = lerp(smoothed.y, uniforms.viewerY, 0.1);

      // Audio pan uses the raw pointer x from the pose position.
      // holographicPanFromPointerX expects the original [-0.5, +0.5] range.
      // Reverse the MOUSE_POSE_LATERAL_MAX scaling to recover pointer.x.
      const rawPointerX = pose.position.x / (0.375 / 0.5);
      audioRef?.current?.setPanFromPointerX(rawPointerX);
      surface.dataset.holographicPan = holographicPanFromPointerX(rawPointerX).toFixed(2);
      surface.dataset.holographicViewerX = smoothed.x.toFixed(3);

      // --- PROJECTION / VIEW / MODEL ---
      const proj = perspective(fov, aspect, 0.1, 40);
      // Camera is fixed at z=6.35, looking toward origin.
      // Viewer pose drives mesh displacement, not camera movement.
      const view = viewOffset(0, 0, cameraZ);
      const vp = mat4Multiply(proj, view);

      // --- VIDEO TEXTURE ---
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

      // --- DRAW ---
      // Only draw once a real decoded frame has been allocated.
      // This preserves the mandatory first-frame gate.
      if (allocatedWidth > 0 && allocatedHeight > 0) {
        const viewH = 2 * Math.tan(fov / 2) * cameraZ;
        const viewW = viewH * aspect;
        const videoAspect = video && video.videoWidth > 0 ? video.videoWidth / video.videoHeight : 16 / 9;
        const { planeW, planeH } = holographicCinemaPlane(viewW, viewH, videoAspect);
        bindMesh(gl, warpProgram, meshBuffer, videoPos, videoUv);
        gl.uniformMatrix4fv(
          videoMvp,
          false,
          mat4Multiply(vp, mat4Multiply(translation(0, 0, 0.15), scaleMat(planeW / 2, planeH / 2, 1))),
        );
        // Viewer position uniforms — from ViewerPose, not raw pointer.
        gl.uniform1f(uViewerX, smoothed.x);
        gl.uniform1f(uViewerY, smoothed.y);
        gl.uniform1f(videoParallax, HOLOGRAPHIC_PARALLAX_STRENGTH);
        gl.uniform1f(videoTime, (performance.now() - started) / 1000);
        // Depth: no real depth source exists yet. Use runtime_synthetic fallback.
        // u_has_depth = 0.0 → shader uses sine-wave envelope.
        // When real depth becomes available, upload it to texture unit 1
        // and set u_has_depth = 1.0.
        gl.uniform1f(uHasDepth, 0.0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, videoTexture);
        gl.uniform1i(uDepth, 1); // texture unit 1 reserved for future depth
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
  }, [signature, poseRef, videoRef, audioRef]);

  return (
    <canvas
      ref={canvasRef}
      className="holographic-theater-webgl"
      data-holographic-theater="pending"
      aria-hidden="true"
    />
  );
}
