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
 * DEPTH ARCHITECTURE:
 *   Domain depth types live in depth-asset.ts (DepthAsset, DepthFrame, DepthIndex).
 *   GPU runtime types live in depth-runtime.ts (RuntimeDepthTexture, DepthController).
 *   SpatialLayer.depth references DepthAsset — the clean domain type.
 *
 *   DepthRepresentation is retained below as a transitional bridge for existing
 *   tests and interfaces. New code should use DepthAsset from depth-asset.ts.
 *   Final direction: domain ≠ GPU runtime. WebGLTexture never in domain objects.
 *
 * SENTINEL BOUNDARY:
 *   Sentinel may observe spatial evidence (depth discontinuities, foreground/
 *   background separation candidates). It does not author DepthAsset records.
 *   Depth becomes canonical only through creator/curator authorisation.
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
 * DepthRepresentation — transitional bridge type.
 *
 * @deprecated Use DepthAsset from depth-asset.ts for new code.
 *
 * Retained for test compatibility. The architectural problem with this type
 * (mixing domain data with GPU runtime state via texture?: WebGLTexture) has
 * been resolved in the Phase 3 depth contract:
 *   - Domain: DepthAsset / DepthFrame / DepthIndex  (depth-asset.ts)
 *   - Runtime: RuntimeDepthTexture / DepthController (depth-runtime.ts)
 *
 * WebGLTexture does NOT appear in DepthAsset. This type is the only remaining
 * location of the mixed concern and will be removed once all callers migrate.
 */
export type DepthRepresentation = {
  source:
    | "runtime_synthetic"
    | "source_provided"
    | "generated"
    | "inferred"
    | "creator_authored";
  confidence?: number;
  width: number;
  height: number;
  /** @deprecated Use DepthFrame.data (Uint8Array) via DepthIndex instead. */
  data?: Float32Array;
  /** @deprecated GPU state. Lives in RuntimeDepthTexture, not domain objects. */
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
   * Optional depth asset for this layer.
   * Absent = renderer uses runtime_synthetic fallback.
   * Present = renderer uses the DepthIndex built from this asset.
   *
   * Uses the clean domain type (DepthAsset from depth-asset.ts).
   * No WebGLTexture here — GPU state lives in DepthController.
   */
  depth?: import("./depth-asset").DepthAsset;
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
