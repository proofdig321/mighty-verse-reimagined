/**
 * Mux asset failure text. Used when a URL pull or Direct Upload errors.
 * Do not invent a percentage or a playable asset from this.
 */

export type MuxErrorPayload = {
  type?: string | null;
  messages?: string[] | null;
};

export function formatMuxAssetFailure(input: {
  status?: string | null;
  errors?: MuxErrorPayload | null;
}): string | null {
  const status = (input.status ?? "").toLowerCase();
  const messages = (input.errors?.messages ?? []).map((item) => item.trim()).filter(Boolean);
  const type = input.errors?.type?.trim();
  if (messages.length && type) return `Mux ${type}: ${messages.join(" ")}`;
  if (messages.length) return `Mux: ${messages.join(" ")}`;
  if (status === "errored") return "Mux asset processing failed.";
  return null;
}
