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
 *   MouseViewController        — pointer + touch events on the cinema element
 *   OrientationViewController  — DeviceOrientationEvent (gyroscope / tilt)
 *
 * Future controllers (not implemented here):
 *   XRViewController           — XRFrame / XRViewerPose
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

// ---------------------------------------------------------------------------
// OrientationViewController — DeviceOrientationEvent (gyroscope / tilt)
// ---------------------------------------------------------------------------

/**
 * Maximum lateral viewer offset driven by device tilt.
 * Matches MOUSE_POSE_LATERAL_MAX so the parallax feel is consistent
 * regardless of input source.
 */
const ORIENTATION_LATERAL_MAX = MOUSE_POSE_LATERAL_MAX;
const ORIENTATION_VERTICAL_MAX = MOUSE_POSE_VERTICAL_MAX;

/**
 * Dead-zone in degrees — small involuntary tilts below this threshold
 * are ignored to prevent jitter when the device is held still.
 */
const ORIENTATION_DEAD_ZONE_DEG = 2.5;

/**
 * Full-scale tilt in degrees — tilt beyond this maps to ±1 in pose space.
 * 20° is a comfortable deliberate tilt without being fatiguing.
 */
const ORIENTATION_FULL_SCALE_DEG = 20;

/**
 * OrientationViewController
 *
 * Converts DeviceOrientationEvent (gamma = left/right tilt, beta = fwd/back
 * tilt) into a ViewerPose. Designed for mobile — tilting the device shifts
 * the parallax perspective without any touch interaction.
 *
 * iOS 13+ requires a user-gesture permission request before
 * DeviceOrientationEvent fires. Call requestPermission() inside a click
 * handler. On Android and desktop the event fires without permission.
 *
 * Usage:
 *   const controller = new OrientationViewController();
 *   await controller.requestPermission();   // iOS only — call from a button
 *   controller.attach();                    // start listening
 *   // in render loop:
 *   const pose = controller.getPose();
 *   // on unmount:
 *   controller.detach();
 */
export class OrientationViewController {
  private _pose: ViewerPose = { ...NEUTRAL_VIEWER_POSE, position: { ...NEUTRAL_VIEWER_POSE.position }, rotation: { ...NEUTRAL_VIEWER_POSE.rotation } };
  private _attached = false;
  private _baseline: { gamma: number; beta: number } | null = null;
  private _handler: ((e: DeviceOrientationEvent) => void) | null = null;

  /**
   * Request DeviceOrientation permission on iOS 13+.
   * Must be called from a user gesture (button click).
   * Returns true if permission was granted or not required.
   * Returns false if denied or API unavailable.
   */
  async requestPermission(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission === "function") {
      try {
        const result: string = await DOE.requestPermission();
        return result === "granted";
      } catch {
        return false;
      }
    }
    // Android / desktop — no permission required.
    return true;
  }

  /** Start listening to DeviceOrientationEvent. */
  attach(): void {
    if (this._attached || typeof window === "undefined") return;
    this._handler = (e: DeviceOrientationEvent) => this._onOrientation(e);
    window.addEventListener("deviceorientation", this._handler);
    this._attached = true;
  }

  /** Stop listening and reset pose to neutral. */
  detach(): void {
    if (!this._attached || !this._handler) return;
    window.removeEventListener("deviceorientation", this._handler);
    this._handler = null;
    this._attached = false;
    this._baseline = null;
    this._pose = { ...NEUTRAL_VIEWER_POSE, position: { ...NEUTRAL_VIEWER_POSE.position }, rotation: { ...NEUTRAL_VIEWER_POSE.rotation } };
  }

  /** Whether the controller is currently attached. */
  get isAttached(): boolean { return this._attached; }

  /** Current ViewerPose derived from device orientation. */
  getPose(): ViewerPose { return this._pose; }

  private _onOrientation(e: DeviceOrientationEvent): void {
    const gamma = e.gamma ?? 0; // left/right tilt: negative = left, positive = right
    const beta  = e.beta  ?? 0; // fwd/back tilt:   negative = forward, positive = back

    // Calibrate on first event — treat the initial orientation as neutral.
    if (!this._baseline) {
      this._baseline = { gamma, beta };
      return;
    }

    const dGamma = gamma - this._baseline.gamma;
    const dBeta  = beta  - this._baseline.beta;

    // Apply dead-zone.
    const ax = Math.abs(dGamma) < ORIENTATION_DEAD_ZONE_DEG ? 0 : dGamma;
    const ay = Math.abs(dBeta)  < ORIENTATION_DEAD_ZONE_DEG ? 0 : dBeta;

    // Map to [-1, +1] over ORIENTATION_FULL_SCALE_DEG.
    const nx = Math.max(-1, Math.min(1, ax / ORIENTATION_FULL_SCALE_DEG));
    const ny = Math.max(-1, Math.min(1, ay / ORIENTATION_FULL_SCALE_DEG));

    this._pose = {
      position: {
        x:  nx * ORIENTATION_LATERAL_MAX,
        y: -ny * ORIENTATION_VERTICAL_MAX, // tilt forward → viewer up
        z: 0,
      },
      rotation: { x: 0, y: 0, z: 0 },
    };
  }
}
