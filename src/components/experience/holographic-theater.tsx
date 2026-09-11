"use client";

import { useEffect, useRef } from "react";
import type { HolographicLayer } from "@/lib/media/sentinel-intelligence";
import { audienceLayerTitle, layerIsActive } from "@/lib/experience/holographic-program";

export type TheaterPointer = { x: number; y: number };

const VERT = `
attribute vec3 a_pos;
attribute vec2 a_uv;
uniform mat4 u_mvp;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = u_mvp * vec4(a_pos, 1.0);
}
`;

const FRAG = `
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

function createProgram(gl: WebGLRenderingContext) {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  return program;
}

function createQuad(gl: WebGLRenderingContext) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1, 0, 0, 1,
      1, -1, 0, 1, 1,
      -1, 1, 0, 0, 0,
      -1, 1, 0, 0, 0,
      1, -1, 0, 1, 1,
      1, 1, 0, 1, 0,
    ]),
    gl.STATIC_DRAW,
  );
  return buffer;
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

export function HolographicTheater({
  layers,
  timeMs,
  pointerRef,
}: {
  layers: HolographicLayer[];
  timeMs: number;
  pointerRef: { current: TheaterPointer };
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
    const glContext = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true });
    if (!glContext) {
      canvas.dataset.holographicTheater = "unavailable";
      return;
    }
    const gl: WebGLRenderingContext = glContext;
    const surface: HTMLCanvasElement = canvas;
    surface.dataset.holographicTheater = "webgl";
    const program = createProgram(gl);
    const quad = createQuad(gl);
    if (!program || !quad) {
      surface.dataset.holographicTheater = "unavailable";
      return;
    }

    const pos = gl.getAttribLocation(program, "a_pos");
    const uv = gl.getAttribLocation(program, "a_uv");
    const mvp = gl.getUniformLocation(program, "u_mvp");
    const alpha = gl.getUniformLocation(program, "u_alpha");
    const tint = gl.getUniformLocation(program, "u_tint");
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    let cancelled = false;
    const textures = new Map<string, WebGLTexture>();

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
      const proj = perspective((42 * Math.PI) / 180, aspect, 0.1, 40);
      const look = pointerRef.current;
      const view = viewOffset(look.x * 1.15, look.y * 0.7, 6.35);
      const vp = mat4Multiply(proj, view);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(uv);
      gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 20, 12);

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
        gl.uniformMatrix4fv(mvp, false, mat4Multiply(vp, model));
        gl.uniform1f(alpha, active ? 0.96 : 0.55);
        gl.uniform3f(tint, active ? 1 : 0.72, active ? 1 : 0.78, active ? 1 : 0.86);
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
    };
  }, [signature, pointerRef]);

  return (
    <canvas
      ref={canvasRef}
      className="holographic-theater-webgl"
      data-holographic-theater="pending"
      aria-hidden="true"
    />
  );
}
