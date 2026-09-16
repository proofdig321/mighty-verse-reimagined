/**
 * Operator-facing generation errors.
 * Technical diagnostics stay available; the primary UI explains the state.
 */

export function operatorGenerationMessage(raw: string | null | undefined): { operator: string; technical: string } {
  const technical = (raw ?? "").trim() || "No technical detail was recorded.";
  const lower = technical.toLowerCase();
  if (lower.includes("spawn") && lower.includes("ffmpeg") && (lower.includes("enoent") || lower.includes("not found"))) {
    return {
      operator: "Generation failed while preparing the source media.",
      technical,
    };
  }
  if (lower.includes("ffmpeg")) {
    return {
      operator: "Generation failed while preparing playable media from the still or clip.",
      technical,
    };
  }
  if (lower.includes("quota") || lower.includes("resource_exhausted")) {
    return {
      operator: "Generation is unavailable because the provider quota is exhausted.",
      technical,
    };
  }
  if (lower.includes("not configured") || lower.includes("unconfigured")) {
    return {
      operator: "Generation needs provider configuration before it can run.",
      technical,
    };
  }
  if (lower.includes("timeout")) {
    return {
      operator: "Generation timed out before an artifact was ready.",
      technical,
    };
  }
  return {
    operator: "Generation failed.",
    technical,
  };
}
