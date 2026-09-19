import {
  HOLOGRAPHIC_CINEMA_FILL,
  HOLOGRAPHIC_PARALLAX_STRENGTH,
  HOLOGRAPHIC_VIDEO_TEXTURE_FLIP_Y,
  holographicCinemaPlane,
  holographicPanFromPointerX,
  holographicMouseUv,
  holographicUvShift,
  holographicPoseUniforms,
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

// holographicUvShift is retained for test coverage but is NOT called by the renderer.
// The renderer uses holographicPoseUniforms() via ViewerPose instead.
// These assertions verify the function's math, not the rendering direction.
assert(holographicUvShift(0) < 0, "holographicUvShift: uv=0 (left) yields negative shift");
assert(holographicUvShift(1) > 0, "holographicUvShift: uv=1 (right) yields positive shift");
assert(HOLOGRAPHIC_PARALLAX_STRENGTH === 0.75, "cursor parallax punch is 0.75");
assert(
  Math.abs(holographicUvShift(0)) > Math.abs(holographicUvShift(0, 0.45)),
  "0.75 parallax separates layers more than the previous 0.45 baseline",
);

// --- ViewerPose → shader uniforms ---
// CORRECTED sign convention: viewer right → u_viewer_x positive → content shifts right.
// The shader uses += so positive u_viewer_x moves vertices right (correct parallax).
const centerPose = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
const rightPose  = { position: { x: 0.375, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
const leftPose   = { position: { x: -0.375, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
const upPose     = { position: { x: 0, y: 0.225, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };

assert(holographicPoseUniforms(centerPose).viewerX === 0, "center pose: u_viewer_x = 0");
assert(holographicPoseUniforms(centerPose).viewerY === 0, "center pose: u_viewer_y = 0");
assert(holographicPoseUniforms(rightPose).viewerX > 0, "viewer right: u_viewer_x positive → content shifts right (corrected)");
assert(holographicPoseUniforms(leftPose).viewerX < 0, "viewer left: u_viewer_x negative → content shifts left (corrected)");
assert(holographicPoseUniforms(upPose).viewerY > 0, "viewer up: u_viewer_y positive → content shifts up (corrected)");
assert(
  holographicPoseUniforms(rightPose).viewerX === -holographicPoseUniforms(leftPose).viewerX,
  "viewer pose uniforms are symmetric",
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

assert(HOLOGRAPHIC_CINEMA_FILL === 1, "cinema plane fills the WebGL view; no dark bezel shrink");
const filled = holographicCinemaPlane(16, 9, 16 / 9);
assert(filled.planeW === 16 && filled.planeH === 9, "matching 16:9 mural occupies the cinema");
const letterbox = holographicCinemaPlane(16, 9, 4 / 3);
assert(letterbox.planeH === 9 && Math.abs(letterbox.planeW - 12) < 0.001, "taller source letterboxes horizontally, not a second screen");
const shrunk = holographicCinemaPlane(16, 9, 16 / 9, 0.94);
assert(shrunk.planeW < filled.planeW, "legacy 0.94 shrink is no longer the cinema default");

console.log("holographic-warp.test.mjs: ok");
