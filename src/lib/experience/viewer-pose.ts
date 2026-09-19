/**
 * Mighty Verse — Viewer Pose Controllers
 *
 * Input adapters that convert device-specific input into a ViewerPose.
 *
 * The renderer receives a ViewerPose. It does not know or care whether
 * the pose came from a mouse, touch device, device orientation sensor,
 * or a future XR headset.
 *
 * Architecture:
 *
 *   Mouse / Touch / DeviceOrientation / WebXR
 *             ↓
 *       [Input Controller]
 *             ↓
 *         ViewerPose
 *             ↓
 *       SpatialRenderer
 *
 * Currently implemented:
 *   MouseViewController — pointer events on the cinema element
 *
 * Future controllers (not implemented here):
 *   OrientationViewController — DeviceOrientationEvent
 *   XRViewController          — XRFrame / XRViewerPose
 */

import { NEUTRAL_VIEWER_POSE, type ViewerPose } from "./spatial-types";

/**
 * Maximum lateral viewer position offset driven by pointer input.
 * Tuned to match the previous parallax feel at HOLOGRAPHIC_PARALLAX_STRENGTH = 0.75.
 * Pointer at ±0.5 (edge) → viewer position at ±MOUSE_POSE_LATERAL_MAX.
 */
export const MOUSE_POSE_LATERAL_MAX = 0.375; // 0.5 * 0.75

/**
 * Maximum vertical viewer position offset driven by pointer input.
 * Reduced by 0.6 to match the previous y-axis parallax reduction.
 */
export const MOUSE_POSE_VERTICAL_MAX = MOUSE_POSE_LATERAL_MAX * 0.6;

/**
 * Convert a cinema-normalized pointer position to a ViewerPose.
 *
 * Pointer convention (from holographic-stage.tsx onMove):
 *   x ∈ [-0.5, +0.5]  — left = -0.5, center = 0, right = +0.5
 *   y ∈ [-0.5, +0.5]  — bottom = -0.5, center = 0, top = +0.5
 *
 * ViewerPose convention:
 *   position.x > 0 → viewer is to the right of center
 *   position.y > 0 → viewer is above center
 *   position.z = 0 (mouse does not control depth)
 *   rotation = { x: 0, y: 0, z: 0 } (mouse does not control rotation in 2.5D mode)
 *
 * The renderer interprets viewer position as: when the viewer moves right,
 * the foreground content appears to shift right (parallax look-around effect).
 */
export function poseFromPointer(pointer: { x: number; y: number }): ViewerPose {
  return {
    position: {
      x: pointer.x * (MOUSE_POSE_LATERAL_MAX / 0.5),
      y: pointer.y * (MOUSE_POSE_VERTICAL_MAX / 0.5),
      z: 0,
    },
    rotation: { x: 0, y: 0, z: 0 },
  };
}

/** Return the neutral pose (viewer centered, no rotation). */
export function neutralPose(): ViewerPose {
  return { ...NEUTRAL_VIEWER_POSE, position: { ...NEUTRAL_VIEWER_POSE.position }, rotation: { ...NEUTRAL_VIEWER_POSE.rotation } };
}

/**
 * MouseViewController
 *
 * Manages the current ViewerPose driven by pointer events on the cinema element.
 * Stores pose in a ref-compatible object so React does not re-render on every
 * pointer move (preserving the existing pointerRef pattern).
 *
 * Usage:
 *   const controller = new MouseViewController();
 *   // on pointer move:
 *   controller.onPointerMove(event, element);
 *   // on pointer leave:
 *   controller.onPointerLeave();
 *   // in render loop:
 *   const pose = controller.getPose();
 */
export class MouseViewController {
  private _pointer: { x: number; y: number } = { x: 0, y: 0 };

  onPointerMove(clientX: number, clientY: number, rect: DOMRect): void {
    this._pointer = {
      x: (clientX - rect.left) / rect.width - 0.5,
      y: 0.5 - (clientY - rect.top) / rect.height,
    };
  }

  onPointerLeave(): void {
    this._pointer = { x: 0, y: 0 };
  }

  /** Raw cinema-normalized pointer position. Used for audio pan. */
  getPointer(): { x: number; y: number } {
    return this._pointer;
  }

  /** Current ViewerPose derived from pointer position. */
  getPose(): ViewerPose {
    return poseFromPointer(this._pointer);
  }
}
