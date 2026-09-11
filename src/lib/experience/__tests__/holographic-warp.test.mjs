import {
  HOLOGRAPHIC_PARALLAX_STRENGTH,
  HOLOGRAPHIC_VIDEO_TEXTURE_FLIP_Y,
  holographicPanFromPointerX,
  holographicMouseUv,
  holographicUvShift,
  shouldUploadMuxVideoFrame,
  tessellatePlane,
  tessellateVertexCount,
} from "../holographic-warp";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(holographicPanFromPointerX(-0.5) === -0.8, "mouse left pans audio to the left ear");
assert(holographicPanFromPointerX(0.5) === 0.8, "mouse right pans audio to the right ear");
assert(holographicPanFromPointerX(0) === 0, "center pointer is center pan");
assert(holographicPanFromPointerX(-2) === -0.8, "pan is clamped");

const left = holographicMouseUv({ x: -0.5, y: 0 });
assert(left.x === 0, "left pointer maps to mouse uv 0");
const right = holographicMouseUv({ x: 0.5, y: 0 });
assert(right.x === 1, "right pointer maps to mouse uv 1");

assert(holographicUvShift(0) < 0, "mouse left yields a negative UV shift (pixels appear to slide right)");
assert(holographicUvShift(1) > 0, "mouse right yields a positive UV shift (pixels appear to slide left)");
assert(HOLOGRAPHIC_PARALLAX_STRENGTH === 0.7, "cursor parallax punch is 0.70");
assert(
  Math.abs(holographicUvShift(0)) > Math.abs(holographicUvShift(0, 0.45)),
  "0.70 parallax separates layers more than the previous 0.45 baseline",
);

assert(shouldUploadMuxVideoFrame({ readyState: 1, currentTime: 1, lastUploadedTime: -1 }) === false, "skip upload before HAVE_CURRENT_DATA");
assert(shouldUploadMuxVideoFrame({ readyState: 2, currentTime: 0, lastUploadedTime: -1, videoWidth: 1280 }) === true, "first decoded frame uploads");
assert(shouldUploadMuxVideoFrame({ readyState: 4, currentTime: 1.2, lastUploadedTime: 1.2, videoWidth: 1280 }) === false, "duplicate Mux clock does not re-upload");
assert(shouldUploadMuxVideoFrame({ readyState: 4, currentTime: 1.24, lastUploadedTime: 1.2, videoWidth: 1280 }) === true, "advanced Mux clock uploads");
assert(shouldUploadMuxVideoFrame({ readyState: 4, currentTime: 3, lastUploadedTime: 1.2, videoWidth: 0 }) === false, "skip upload until video dimensions exist");

assert(HOLOGRAPHIC_VIDEO_TEXTURE_FLIP_Y === false, "Mux VideoTexture.flipY stays false (UNPACK_FLIP_Y off)");

const mesh = tessellatePlane(4);
assert(mesh.length === tessellateVertexCount(4) * 5, "tessellated plane stores x,y,z,u,v per vertex");
assert(tessellateVertexCount(64) === 64 * 64 * 6, "production mesh is a 64x64 triangle grid");
assert(mesh[1] === 1 && mesh[4] === 0, "v=0 is the top of the plane; do not invert vertex math for orientation");

console.log("holographic-warp.test.mjs: ok");
