import {
  HOLOGRAPHIC_PARALLAX_STRENGTH,
  HOLOGRAPHIC_VIDEO_TEXTURE_FLIP_Y,
  holographicPanFromPointerX,
  holographicMouseUv,
  holographicUvShift,
  muxVideoTextureUpdate,
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
assert(HOLOGRAPHIC_PARALLAX_STRENGTH === 0.75, "cursor parallax punch is 0.75");
assert(
  Math.abs(holographicUvShift(0)) > Math.abs(holographicUvShift(0, 0.45)),
  "0.75 parallax separates layers more than the previous 0.45 baseline",
);

assert(
  muxVideoTextureUpdate({ readyState: 1, videoWidth: 1280, videoHeight: 720, allocatedWidth: 0, allocatedHeight: 0 }) === "skip",
  "skip GPU upload before HAVE_CURRENT_DATA",
);
assert(
  muxVideoTextureUpdate({ readyState: 4, videoWidth: 0, videoHeight: 0, allocatedWidth: 0, allocatedHeight: 0 }) === "skip",
  "skip GPU upload until Mux has pixel dimensions",
);
assert(
  muxVideoTextureUpdate({ readyState: 2, videoWidth: 1280, videoHeight: 720, allocatedWidth: 0, allocatedHeight: 0 }) === "allocate",
  "first decoded frame allocates the video texture",
);
assert(
  muxVideoTextureUpdate({ readyState: 4, videoWidth: 1280, videoHeight: 720, allocatedWidth: 1280, allocatedHeight: 720 }) === "subimage",
  "same Mux resolution updates in place with texSubImage2D",
);
assert(
  muxVideoTextureUpdate({ readyState: 4, videoWidth: 1920, videoHeight: 1080, allocatedWidth: 1280, allocatedHeight: 720 }) === "allocate",
  "HLS resolution change reallocates instead of timestamp-skipping",
);
assert(
  muxVideoTextureUpdate({ readyState: 4, videoWidth: 1280, videoHeight: 720, allocatedWidth: 1280, allocatedHeight: 720 }) === "subimage",
  "duplicate HLS currentTime is not part of the upload gate",
);

assert(HOLOGRAPHIC_VIDEO_TEXTURE_FLIP_Y === false, "Mux VideoTexture.flipY stays false (UNPACK_FLIP_Y off)");

const mesh = tessellatePlane(4);
assert(mesh.length === tessellateVertexCount(4) * 5, "tessellated plane stores x,y,z,u,v per vertex");
assert(tessellateVertexCount(64) === 64 * 64 * 6, "production mesh is a 64x64 triangle grid");
assert(mesh[1] === 1 && mesh[4] === 0, "v=0 is the top of the plane; do not invert vertex math for orientation");

console.log("holographic-warp.test.mjs: ok");
