// ISRC core — construction, validation, normalization.
// ISO 3901: 12 uppercase alphanumeric characters.
// Structure: PREFIX(5) + YEAR(2) + DESIGNATION(5)
// Display:   AA-6QZ-26-00001  (hyphens added for readability only)
// Storage:   AA6QZ2600001     (canonical, no hyphens)

export const ISRC_PATTERN = /^[A-Z0-9]{12}$/;
export const ISRC_DISPLAY_PATTERN = /^[A-Z]{2}-[A-Z0-9]{3}-[0-9]{2}-[0-9]{5}$/;
export const PREFIX_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}$/;

export type IsrcStatus =
  | "verified"           // externally confirmed by ISRC Agency
  | "assigned"           // generated internally by Mighty Verse, not yet externally confirmed
  | "pending"            // applicable but not yet obtained
  | "assignment-required" // Golden Shovel needs to assign/obtain one
  | "not-provided"       // released but no ISRC supplied
  | "not-applicable";    // non-ISRC-eligible recording

export const ISRC_STATUS_LABELS: Record<IsrcStatus, string> = {
  "verified":            "Verified",
  "assigned":            "Assigned",
  "pending":             "Pending",
  "assignment-required": "Assignment Required",
  "not-provided":        "Not Provided",
  "not-applicable":      "Not Applicable",
};

/** Normalize an ISRC to canonical storage form (uppercase, no hyphens, 12 chars). */
export function normalizeIsrc(raw: string): string {
  return raw.toUpperCase().replace(/-/g, "").trim();
}

/** Validate a canonical (normalized) ISRC. Returns null if valid, error string if not. */
export function validateIsrc(isrc: string): string | null {
  if (!ISRC_PATTERN.test(isrc)) {
    return `ISRC must be exactly 12 uppercase alphanumeric characters (got: ${isrc})`;
  }
  // Structural decomposition check
  const prefix = isrc.slice(0, 5);
  const year   = isrc.slice(5, 7);
  const desig  = isrc.slice(7, 12);
  if (!PREFIX_PATTERN.test(prefix)) {
    return `ISRC prefix must be 2 letters + 3 alphanumeric characters (got: ${prefix})`;
  }
  if (!/^[0-9]{2}$/.test(year)) {
    return `ISRC year must be 2 digits (got: ${year})`;
  }
  if (!/^[0-9]{5}$/.test(desig)) {
    return `ISRC designation must be 5 digits (got: ${desig})`;
  }
  return null;
}

/** Construct a canonical ISRC from components. Does not validate prefix authorization. */
export function constructIsrc(prefix: string, year: number, designation: number): string {
  const y = String(year % 100).padStart(2, "0");
  const d = String(designation).padStart(5, "0");
  return `${prefix}${y}${d}`;
}

/** Format a canonical ISRC for display: AABBB-YY-DDDDD → AA-BBB-YY-DDDDD */
export function formatIsrcDisplay(isrc: string): string {
  if (isrc.length !== 12) return isrc;
  return `${isrc.slice(0, 2)}-${isrc.slice(2, 5)}-${isrc.slice(5, 7)}-${isrc.slice(7, 12)}`;
}

/** Extract year-of-reference (2-digit) from a canonical ISRC. */
export function isrcYear(isrc: string): string {
  return isrc.slice(5, 7);
}

/** Extract designation (integer) from a canonical ISRC. */
export function isrcDesignation(isrc: string): number {
  return parseInt(isrc.slice(7, 12), 10);
}

/** Extract prefix from a canonical ISRC. */
export function isrcPrefix(isrc: string): string {
  return isrc.slice(0, 5);
}

/**
 * Determine whether a realization_type is ISRC-eligible.
 *
 * Every distinct media recording/realization in Mighty Verse is capable of
 * carrying its own ISRC. ISRC identifies the specific recording, not the work.
 * No realization type is blanket-excluded merely because it is visual or derived.
 *
 * Eligible types (all realization_type values that represent distinct recordings):
 *   original-recording  — sound recording
 *   music-video         — music video recording
 *   animated-video      — animated audiovisual recording
 *   visualisation       — audiovisual visualisation recording
 *   live-performance    — live sound recording
 *   broadcast-recording — broadcast sound recording
 *
 * Not eligible:
 *   other — catch-all; operator must reclassify before ISRC assignment
 */
export function isIsrcEligible(realizationType: string): boolean {
  return realizationType === "original-recording" ||
         realizationType === "music-video" ||
         realizationType === "animated-video" ||
         realizationType === "visualisation" ||
         realizationType === "live-performance" ||
         realizationType === "broadcast-recording";
}

/**
 * Determine the recording category for display and ISRC workflow.
 *
 * Returns a deterministic category string for each realization_type.
 * Used by the Authority UI to label ISRCs distinctly per recording type.
 * ISRC is NEVER shared across categories — each recording gets its own.
 */
export function recordingCategory(
  realizationType: string
): "sound-recording" | "music-video" | "animated-video" | "visualisation" | "other" {
  if (realizationType === "original-recording" ||
      realizationType === "live-performance" ||
      realizationType === "broadcast-recording") {
    return "sound-recording";
  }
  if (realizationType === "music-video") return "music-video";
  if (realizationType === "animated-video") return "animated-video";
  if (realizationType === "visualisation") return "visualisation";
  return "other";
}

export const RECORDING_CATEGORY_LABELS: Record<string, string> = {
  "sound-recording": "Sound Recording",
  "music-video":     "Music Video Recording",
  "animated-video":  "Animated Video Recording",
  "visualisation":   "Visualisation Recording",
  "other":           "Other",
};
