/**
 * Cursor → hologram mapping for the Mux cinema.
 *
 * Pointer is cinema-normalized: x/y ∈ [-0.5, +0.5] with origin at center.
 *
 * Mouse left  (-0.5) → warp pixels right (parallax) + pan audio left  (-0.8)
 * Mouse right (+0.5) → warp pixels left  + pan audio right (+0.8)
 */

export const HOLOGRAPHIC_PAN_MAX = 0.8;
export const HOLOGRAPHIC_PARALLAX_STRENGTH = 0.7;
export const HOLOGRAPHIC_MESH_SEGMENTS = 64;

/** HTMLVideoElement.HAVE_CURRENT_DATA — frame pixels exist to upload. */
export const VIDEO_HAVE_CURRENT_DATA = 2;

/**
 * Three.js `texture.flipY = false` for the Mux HTML video texture.
 * Mesh UVs put v=0 at the top of the plane, so unpack-flip must stay off
 * or Golden Shovel titles and characters render upside down.
 */
export const HOLOGRAPHIC_VIDEO_TEXTURE_FLIP_Y = false;

export type TheaterPointer = { x: number; y: number };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Stereo pan from cinema pointer x. Left ear = negative. */
export function holographicPanFromPointerX(x: number): number {
  return clamp(x * (HOLOGRAPHIC_PAN_MAX / 0.5), -HOLOGRAPHIC_PAN_MAX, HOLOGRAPHIC_PAN_MAX);
}

/** Shader u_mouse in 0..1 from cinema pointer. */
export function holographicMouseUv(pointer: TheaterPointer): { x: number; y: number } {
  return {
    x: clamp(pointer.x + 0.5, 0, 1),
    y: clamp(pointer.y + 0.5, 0, 1),
  };
}

/**
 * UV sample offset that shears the picture opposite the cursor.
 * Mouse left (uv.x < 0.5) yields a negative offset so content appears to slide right.
 */
export function holographicUvShift(mouseUv: number, strength = HOLOGRAPHIC_PARALLAX_STRENGTH): number {
  return (mouseUv - 0.5) * strength;
}

/**
 * Skip blocking `texImage2D` until Mux has a net-new decoded frame.
 * rAF still draws the last GPU texture so cursor parallax stays at display rate.
 */
export function shouldUploadMuxVideoFrame(input: {
  readyState: number;
  currentTime: number;
  lastUploadedTime: number;
  videoWidth?: number;
}): boolean {
  if (input.readyState < VIDEO_HAVE_CURRENT_DATA) return false;
  if ((input.videoWidth ?? 1) <= 0) return false;
  if (!Number.isFinite(input.currentTime)) return false;
  if (input.currentTime === input.lastUploadedTime) return false;
  return true;
}

/**
 * Dense 16:9-ready plane in clip-local space [-1, 1].
 * Each vertex is x, y, z, u, v. Triangle list, 6 verts per cell.
 * v=0 is the top of the plane (y=+1). Do not invert this to "fix" video orientation —
 * set HOLOGRAPHIC_VIDEO_TEXTURE_FLIP_Y instead.
 */
export function tessellatePlane(segments = HOLOGRAPHIC_MESH_SEGMENTS): Float32Array {
  const count = Math.max(2, Math.floor(segments));
  const verts = new Float32Array(count * count * 6 * 5);
  let i = 0;
  const push = (ix: number, iy: number) => {
    const u = ix / count;
    const v = iy / count;
    verts[i++] = u * 2 - 1;
    verts[i++] = 1 - v * 2;
    verts[i++] = 0;
    verts[i++] = u;
    verts[i++] = v;
  };
  for (let y = 0; y < count; y += 1) {
    for (let x = 0; x < count; x += 1) {
      push(x, y);
      push(x + 1, y);
      push(x, y + 1);
      push(x, y + 1);
      push(x + 1, y);
      push(x + 1, y + 1);
    }
  }
  return verts;
}

export function tessellateVertexCount(segments = HOLOGRAPHIC_MESH_SEGMENTS): number {
  const count = Math.max(2, Math.floor(segments));
  return count * count * 6;
}
