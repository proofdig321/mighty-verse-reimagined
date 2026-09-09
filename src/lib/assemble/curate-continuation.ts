/**
 * Contextual next actions after Curate associate / register.
 * Not a wizard. Derived from live association state.
 */

import {
  creativeSuiteHref,
  creativeSuiteSentinelHref,
  curateStudioHref,
  mediaInspectHref,
} from "./studio";

export type CurateContinuationAction = {
  href: string;
  label: string;
};

export type CurateContinuation = {
  copy: string;
  actions: CurateContinuationAction[];
};

export function curateContinuation(input: {
  universeId: string | null;
  assetId?: string | null;
  associated?: boolean;
  muralRegistered?: boolean;
  mediaAttached?: boolean;
  inspected?: boolean;
}): CurateContinuation {
  const universeId = input.universeId;
  if (!universeId) {
    return {
      copy: "Associate this media with an existing Universe, or register a Mural for a Universe that has none. Uploading media does not create a Universe.",
      actions: [],
    };
  }

  const actions: CurateContinuationAction[] = [];
  if (input.assetId) {
    actions.push({ href: mediaInspectHref(input.assetId), label: "Inspect" });
    actions.push({ href: curateStudioHref(universeId, input.assetId), label: "Sentinel" });
  }
  actions.push({ href: creativeSuiteHref(universeId, "curate"), label: "Open Creative Studio" });
  if (input.assetId) {
    actions.push({ href: creativeSuiteSentinelHref(universeId, "curate"), label: "Storyboard in Suite" });
  }

  if (input.muralRegistered && !input.mediaAttached && !input.assetId) {
    return {
      copy: "Mural registered. Media is not attached. Next: associate incoming media, then inspect, then continue in Creative Studio for storyboard, animation planning, and 2.5D Preview.",
      actions: [
        { href: "/authority/curate", label: "Incoming media" },
        { href: creativeSuiteHref(universeId, "curate"), label: "Open Creative Studio" },
      ],
    };
  }

  if (input.associated || input.mediaAttached) {
    return {
      copy: "Associated. Next: inspect the media, review Sentinel evidence, then continue in Creative Studio. Storyboard, animation planning, and 2.5D Preview live in the Studio — not as a public Experience substitute.",
      actions,
    };
  }

  return {
    copy: "This Universe is the canonical work. Inspect associated media, then continue in Creative Studio to assemble storyboard, animation, authorisation, and 2.5D Preview. Experience remains separate.",
    actions,
  };
}
