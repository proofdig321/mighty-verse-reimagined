import {
  NEUTRAL_VIEWER_POSE,
  spatialSceneFromLayers,
} from "../spatial-types";
import {
  poseFromPointer,
  neutralPose,
  MouseViewController,
  MOUSE_POSE_LATERAL_MAX,
  MOUSE_POSE_VERTICAL_MAX,
} from "../viewer-pose";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function approx(a, b, tolerance = 1e-9) {
  return Math.abs(a - b) <= tolerance;
}

// --- NEUTRAL_VIEWER_POSE ---
assert(NEUTRAL_VIEWER_POSE.position.x === 0, "neutral pose: position.x = 0");
assert(NEUTRAL_VIEWER_POSE.position.y === 0, "neutral pose: position.y = 0");
assert(NEUTRAL_VIEWER_POSE.position.z === 0, "neutral pose: position.z = 0");
assert(NEUTRAL_VIEWER_POSE.rotation.x === 0, "neutral pose: rotation.x = 0");
assert(NEUTRAL_VIEWER_POSE.rotation.y === 0, "neutral pose: rotation.y = 0");
assert(NEUTRAL_VIEWER_POSE.rotation.z === 0, "neutral pose: rotation.z = 0");

// --- neutralPose() ---
const np = neutralPose();
assert(np.position.x === 0 && np.position.y === 0 && np.position.z === 0, "neutralPose returns zero position");
assert(np.rotation.x === 0 && np.rotation.y === 0 && np.rotation.z === 0, "neutralPose returns zero rotation");

// --- poseFromPointer ---
// Center pointer → neutral pose
const center = poseFromPointer({ x: 0, y: 0 });
assert(center.position.x === 0, "center pointer: pose.position.x = 0");
assert(center.position.y === 0, "center pointer: pose.position.y = 0");
assert(center.position.z === 0, "center pointer: pose.position.z = 0");

// Right pointer → positive x position (viewer right → content shifts right)
const rightPose = poseFromPointer({ x: 0.5, y: 0 });
assert(rightPose.position.x > 0, "pointer right: pose.position.x > 0 (corrected parallax direction)");
assert(approx(rightPose.position.x, MOUSE_POSE_LATERAL_MAX), "pointer at +0.5 maps to MOUSE_POSE_LATERAL_MAX");

// Left pointer → negative x position
const leftPose = poseFromPointer({ x: -0.5, y: 0 });
assert(leftPose.position.x < 0, "pointer left: pose.position.x < 0");
assert(approx(leftPose.position.x, -MOUSE_POSE_LATERAL_MAX), "pointer at -0.5 maps to -MOUSE_POSE_LATERAL_MAX");

// Symmetry
assert(
  approx(rightPose.position.x, -leftPose.position.x),
  "pointer pose is symmetric: right = -left",
);

// Up pointer → positive y position
const upPose = poseFromPointer({ x: 0, y: 0.5 });
assert(upPose.position.y > 0, "pointer up: pose.position.y > 0");
assert(approx(upPose.position.y, MOUSE_POSE_VERTICAL_MAX), "pointer at +0.5y maps to MOUSE_POSE_VERTICAL_MAX");

// Vertical is reduced relative to lateral (0.6 factor)
assert(
  approx(MOUSE_POSE_VERTICAL_MAX, MOUSE_POSE_LATERAL_MAX * 0.6),
  "vertical max is 0.6 of lateral max",
);

// Rotation is always zero (mouse does not control rotation in 2.5D mode)
assert(rightPose.rotation.x === 0 && rightPose.rotation.y === 0 && rightPose.rotation.z === 0,
  "mouse pose has no rotation component");

// --- MouseViewController ---
const controller = new MouseViewController();

// Initial state: neutral
const initial = controller.getPose();
assert(initial.position.x === 0 && initial.position.y === 0, "controller starts at neutral pose");

// Simulate pointer move to right edge of a 100×100 element
const rect = { left: 0, top: 0, width: 100, height: 100 };
controller.onPointerMove(100, 50, rect); // right edge, vertical center
const rightEdgePose = controller.getPose();
assert(rightEdgePose.position.x > 0, "pointer at right edge: pose.position.x > 0");
assert(approx(rightEdgePose.position.x, MOUSE_POSE_LATERAL_MAX), "right edge maps to MOUSE_POSE_LATERAL_MAX");

// Simulate pointer move to left edge
controller.onPointerMove(0, 50, rect);
const leftEdgePose = controller.getPose();
assert(leftEdgePose.position.x < 0, "pointer at left edge: pose.position.x < 0");

// Pointer leave → neutral
controller.onPointerLeave();
const afterLeave = controller.getPose();
assert(afterLeave.position.x === 0 && afterLeave.position.y === 0, "onPointerLeave resets to neutral pose");

// Raw pointer is accessible for audio pan
controller.onPointerMove(100, 50, rect);
const rawPointer = controller.getPointer();
assert(approx(rawPointer.x, 0.5), "getPointer returns raw cinema-normalized x");

// --- spatialSceneFromLayers ---
const layers = [
  { layer_id: "mural-1", depth: 0, offset_x: 0, offset_y: 28 },
  { layer_id: "scene-1", depth: 72, offset_x: -108, offset_y: -8 },
  { layer_id: "scene-2", depth: 144, offset_x: 108, offset_y: 22 },
];
const scene = spatialSceneFromLayers(layers);
assert(scene.layers.length === 3, "spatialSceneFromLayers produces one SpatialLayer per input");
assert(scene.hasRealDepth === false, "no real depth source: hasRealDepth = false");
assert(scene.layers[0].id === "mural-1", "layer id preserved");
assert(scene.layers[1].presentationOrder === 72, "presentationOrder maps from HolographicLayer.depth");
assert(scene.layers[1].presentationOffset.x === -108, "presentationOffset.x maps from offset_x");
assert(scene.layers[2].presentationOffset.y === 22, "presentationOffset.y maps from offset_y");
assert(scene.layers[0].depth === undefined, "no DepthRepresentation on layers without real depth");

// Presentation depth is NOT measured spatial depth
assert(
  scene.layers[1].presentationOrder !== undefined && scene.layers[1].depth === undefined,
  "presentationOrder (layout hint) is distinct from depth (DepthRepresentation)",
);

console.log("spatial-types + viewer-pose tests: all passed");
