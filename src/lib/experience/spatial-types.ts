/**
 * Mighty Verse — Spatial Rendering Types
 *
 * These types establish the architectural boundary between:
 *
 *   INPUT (mouse / touch / device orientation / future XR)
 *     ↓
 *   ViewerPose
 *     ↓
 *   SpatialRenderer
 *     ↓
 *   GPU / Screen / XR target
 *
 * They do not replace canonical Universe/Mural/Scene/HolographicLayer records.
 * They are the renderer-facing representation of what to draw and from where.
 *
 * DEPTH CONVENTION (for future depth texture support):
 *   - White (1.0) = near (foreground)
 *   - Black (0.0) = far (background)
 *   - Values are linear in normalized device depth [0, 1]
 *   - No gamma correction applied to depth values
 *   - Depth is clamped to [0, 1] before use
 *   - A depth value of 0.5 represents the mid-plane of the scene
 *
 * DEPTH PROVENANCE:
 *   Any depth representation must carry its provenance so the renderer and UI
 *   can distinguish measured evidence from synthetic fallback.
 *
 *   "runtime_synthetic" — the current sine-wave envelope. Content-blind.
 *                         Not a depth map. Used as a fallback only.
 *   "source_provided"   — a depth track embedded in the source media.
 *   "generated"         — monocular depth estimation run against the video.
 *   "inferred"          — Sentinel spatial observations used as proxy.
 *   "creator_authored"  — a depth mask drawn or approved by the creator.
 *
 * SENTINEL BOUNDARY:
 *   Sentinel may observe spatial evidence (depth discontinuities, foreground/
 *   background separation candidates). It does not author DepthRepresentation
 *   records. Depth becomes canonical only through creator/curator authorisation.
 */

/** The viewer's position and orientation in the spatial scene. */
export type ViewerPose = {
  /**
   * Viewer position relative to the scene origin.
   * Units are scene-local (not pixels, not UV).
   * Default: { x: 0, y: 0, z: 0 } — centered, at origin.
   */
  position: { x: number; y: number; z: number };

  /**
   * Viewer rotation in radians (Euler angles, XYZ order).
   * Default: { x: 0, y: 0, z: 0 } — looking straight ahead.
   * Positive x = tilt up. Positive y = turn right. Positive z = roll right.
   */
  rotation: { x: number; y: number; z: number };
};

/** A neutral viewer pose — centered, no rotation. */
export const NEUTRAL_VIEWER_POSE: ViewerPose = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
};

/**
 * Depth representation for a spatial layer.
 *
 * Currently no real depth source exists. The renderer uses a runtime_synthetic
 * sine-wave fallback when depth is absent or synthetic.
 *
 * This type establishes the interface for future depth sources without
 * fabricating data that does not exist.
 */
export type DepthRepresentation = {
  /**
   * Provenance of this depth data.
   * The renderer and UI must distinguish these categories.
   * "runtime_synthetic" must never be presented as measured spatial truth.
   */
  source:
    | "runtime_synthetic"
    | "source_provided"
    | "generated"
    | "inferred"
    | "creator_authored";

  /**
   * Confidence in this depth representation [0, 1].
   * 1.0 = high confidence (e.g. source-provided stereo depth).
   * 0.0 = no confidence (e.g. runtime_synthetic fallback).
   * Absent = unknown.
   */
  confidence?: number;

  /** Width of the depth map in pixels. */
  width: number;

  /** Height of the depth map in pixels. */
  height: number;

  /**
   * Depth data as a Float32Array of normalized values [0, 1].
   * White (1.0) = near. Black (0.0) = far.
   * Length must equal width × height.
   * Absent when source is "runtime_synthetic" — the renderer generates
   * the fallback procedurally.
   */
  data?: Float32Array;

  /**
   * Optional WebGL texture handle. Set by the renderer after GPU upload.
   * Not serializable. Not persisted.
   */
  texture?: WebGLTexture;
};

/**
 * A single spatial layer in the scene.
 *
 * Separates presentation ordering (depth, offset) from measured spatial depth.
 * HolographicLayer.depth is a presentation hint, not a depth map.
 */
export type SpatialLayer = {
  /** Stable identifier for this layer. */
  id: string;

  /**
   * Presentation ordering — higher values render further back.
   * This is a layout hint derived from canonical Scene sort order.
   * It is NOT a measured depth value.
   */
  presentationOrder: number;

  /**
   * Presentation offset in scene-local units.
   * Used for the composition layout (e.g. scene orbit positions).
   * NOT a spatial position derived from depth analysis.
   */
  presentationOffset: { x: number; y: number };

  /**
   * Optional depth representation for this layer.
   * Absent = renderer uses runtime_synthetic fallback.
   * Present = renderer uses the provided depth data.
   */
  depth?: DepthRepresentation;
};

/**
 * The complete spatial scene description passed to the renderer.
 *
 * This is the renderer-facing representation. It is derived from canonical
 * HolographicProgram data but is independent of the input device.
 *
 * The renderer must not need to know whether the viewer pose came from
 * a mouse, touch device, device orientation, or XR headset.
 */
export type SpatialScene = {
  layers: SpatialLayer[];

  /**
   * Whether any layer has real (non-synthetic) depth.
   * When false, the renderer uses the runtime_synthetic fallback for all layers.
   */
  hasRealDepth: boolean;
};

/** Derive a SpatialScene from HolographicLayer presentation data. */
export function spatialSceneFromLayers(
  layers: { layer_id: string; depth: number; offset_x: number; offset_y: number }[],
): SpatialScene {
  return {
    layers: layers.map((layer) => ({
      id: layer.layer_id,
      presentationOrder: layer.depth,
      presentationOffset: { x: layer.offset_x, y: layer.offset_y },
      // No real depth source exists yet. Renderer will use runtime_synthetic fallback.
    })),
    hasRealDepth: false,
  };
}
