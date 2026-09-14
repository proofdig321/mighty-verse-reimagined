/**
 * Canonical distribution readiness — derived from live records.
 *
 * Mighty Verse is the official home. YouTube / Spotify / Vimeo are future
 * distributional projections, not live adapters. This checklist does not
 * pretend those adapters exist.
 */

export type DistributionGateId =
  | "identity"
  | "rights"
  | "canonical_bind"
  | "isrc"
  | "public_experience";

export type DistributionGate = {
  id: DistributionGateId;
  label: string;
  ready: boolean;
  summary: string;
  href?: string;
  actionLabel?: string;
};

export type ExternalProjectionStatus = {
  platform: "youtube" | "spotify" | "vimeo";
  live: false;
  summary: string;
};

export type DistributionReadiness = {
  readyForCanonicalHome: boolean;
  gates: DistributionGate[];
  external: ExternalProjectionStatus[];
  note: string;
};

export type DistributionReadinessInput = {
  title: string | null;
  rightsHolder: string | null;
  rightsBasis: string | null;
  boundMasterId: string | null;
  boundMasterTitle: string | null;
  publicHref: string | null;
  isrc: string | null;
  isrcStatus: string | null;
  isrcEligible: boolean;
  identityHref?: string | null;
  rightsHref?: string | null;
  isrcHref?: string | null;
};

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function deriveDistributionReadiness(input: DistributionReadinessInput): DistributionReadiness {
  const identityReady = hasText(input.title);
  const rightsReady = hasText(input.rightsHolder) && hasText(input.rightsBasis);
  const boundReady = Boolean(input.boundMasterId);
  const isrcReady = input.isrcEligible
    ? hasText(input.isrc) || input.isrcStatus === "assigned" || input.isrcStatus === "verified"
    : true;
  const publicReady = Boolean(input.publicHref);

  const gates: DistributionGate[] = [
    {
      id: "identity",
      label: "Identity",
      ready: identityReady,
      summary: identityReady ? (input.title as string) : "Title is missing on the work record.",
      href: input.identityHref ?? undefined,
      actionLabel: identityReady ? "Edit identity" : "Add title",
    },
    {
      id: "rights",
      label: "Rights",
      ready: rightsReady,
      summary: rightsReady
        ? `${input.rightsHolder} · ${input.rightsBasis}`
        : "Rights holder and basis are required before this media is a distribution source.",
      href: input.rightsHref ?? undefined,
      actionLabel: "Review rights",
    },
    {
      id: "canonical_bind",
      label: "Canonical bind",
      ready: boundReady,
      summary: boundReady
        ? `Bound to ${input.boundMasterTitle ?? "canonical work"}.`
        : "Associate this asset with an existing Universe Mural. MEDIA ≠ CREATIVE WORK.",
      href: boundReady && input.boundMasterId ? `/authority/${input.boundMasterId}` : "/authority/curate",
      actionLabel: boundReady ? "Open work" : "Associate with Mural",
    },
    {
      id: "isrc",
      label: "ISRC",
      ready: isrcReady,
      summary: input.isrcEligible
        ? isrcReady
          ? input.isrc ?? input.isrcStatus ?? "Assigned"
          : "Sound/music-video realizations need an ISRC before music-platform projections."
        : "Not applicable — this realization is not an ISRC recording.",
      href: input.isrcHref ?? undefined,
      actionLabel: input.isrcEligible ? "Open ISRC" : undefined,
    },
    {
      id: "public_experience",
      label: "Public Experience",
      ready: publicReady,
      summary: publicReady
        ? "Audience can reach this work on Mighty Verse."
        : "Public Experience waits until the asset is bound to a Universe.",
      href: input.publicHref ?? undefined,
      actionLabel: publicReady ? "Open public page" : undefined,
    },
  ];

  return {
    readyForCanonicalHome: identityReady && rightsReady && boundReady,
    gates,
    external: [
      {
        platform: "youtube",
        live: false,
        summary: "YouTube remains a future distributional projection. Ingest from YouTube is intake, not publish-out.",
      },
      {
        platform: "spotify",
        live: false,
        summary: "Spotify remains a future distributional projection. ISRC is the music-industry gate, not a live adapter.",
      },
      {
        platform: "vimeo",
        live: false,
        summary: "Vimeo remains a future distributional projection. Animation stills and Mux playback live on Mighty Verse first.",
      },
    ],
    note: "Mighty Verse is the canonical distribution home. External platforms consume projections of this work; they do not become identity.",
  };
}
