"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { XRViewController } from "./viewer-pose";
import type { ViewerPose } from "./spatial-types";

/**
 * useXRSession
 *
 * Manages WebXR immersive-vr session lifecycle for a spatial cinema.
 * Returns the session ref (passed to HolographicTheater), a supported flag,
 * and enter/exit handlers to wire to UI buttons.
 *
 * The hook owns the XRViewController and merges XR pose into poseRef
 * each XR animation frame when a session is active.
 *
 * UX rule: "Enter VR" is only shown when navigator.xr reports support.
 * The button is a user gesture — required by the WebXR spec.
 */
export function useXRSession(poseRef: { current: ViewerPose }) {
  const xrSessionRef = useRef<XRSession | null>(null);
  const xrControllerRef = useRef(new XRViewController());
  const [xrSupported, setXrSupported] = useState(false);
  const [xrActive, setXrActive] = useState(false);

  // Probe XR support once on mount (async — no permission required).
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.xr) return;
    navigator.xr.isSessionSupported("immersive-vr").then((supported) => {
      setXrSupported(supported);
    }).catch(() => { /* XR unavailable */ });
  }, []);

  const enterXR = useCallback(async () => {
    if (!navigator.xr) return;
    try {
      const session = await navigator.xr.requestSession("immersive-vr");
      xrSessionRef.current = session;
      setXrActive(true);

      // Obtain a local-floor reference space for head tracking.
      const refSpace = await session.requestReferenceSpace("local-floor").catch(
        () => session.requestReferenceSpace("local"),
      );

      // Drive poseRef from XR frames.
      const onXRFrame = (_t: number, frame: XRFrame) => {
        xrControllerRef.current.onXRFrame(frame, refSpace as XRReferenceSpace);
        poseRef.current = xrControllerRef.current.getPose();
        if (xrSessionRef.current === session) {
          session.requestAnimationFrame(onXRFrame);
        }
      };
      session.requestAnimationFrame(onXRFrame);

      session.addEventListener("end", () => {
        xrSessionRef.current = null;
        setXrActive(false);
      });
    } catch { /* user cancelled or device unavailable */ }
  }, [poseRef]);

  const exitXR = useCallback(() => {
    xrSessionRef.current?.end().catch(() => {});
  }, []);

  return { xrSessionRef, xrSupported, xrActive, enterXR, exitXR };
}
