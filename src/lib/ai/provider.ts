/**
 * Gemini API adapter for Storyboard assist and image generation.
 *
 * Chrome on-device Prompt API lives in `chrome.ts` and is preferred in the
 * curator browser. This module is the production-safe server fallback.
 * Neither writes canonical ontology. Unavailable is an honest status.
 */

export { STORYBOARD_SYSTEM } from "./chrome";
export { geminiApiKey } from "./provider-key";
export { aiServiceCapability, aiModelConfig } from "./config";

import { aiServiceCapability } from "./config";
import { generateGeminiImageBytes, generateGeminiText } from "./gemini";

export type AiProviderId = "chrome-prompt" | "gemini" | "none";

export type AiCapability = {
  provider: AiProviderId;
  configured: boolean;
  text: boolean;
  image: boolean;
  video: boolean;
  label: string;
};

export type AiTextResult =
  | { ok: true; provider: Exclude<AiProviderId, "none">; text: string; creates_canonical: false }
  | { ok: false; status: "unavailable" | "failed"; message: string; provider: AiProviderId };

export function serverAiCapability(): AiCapability {
  const capability = aiServiceCapability();
  return {
    provider: capability.provider,
    configured: capability.configured,
    text: capability.text,
    image: capability.image,
    video: capability.video,
    label: capability.label,
  };
}

export async function promptWithGemini(input: {
  system: string;
  prompt: string;
  model?: string;
}): Promise<AiTextResult> {
  const result = await generateGeminiText(input);
  if (!result.ok) {
    return {
      ok: false,
      status: result.status === "needs_configuration" ? "unavailable" : result.status === "unavailable" ? "unavailable" : "failed",
      message: result.message,
      provider: result.provider,
    };
  }
  return { ok: true, provider: "gemini", text: result.text, creates_canonical: false };
}

export async function generateGeminiImage(input: {
  prompt: string;
}): Promise<
  | { ok: true; mime: string; bytes: Buffer; creates_canonical: false }
  | { ok: false; status: "unavailable" | "failed"; message: string }
> {
  const result = await generateGeminiImageBytes(input);
  if (!result.ok) {
    return {
      ok: false,
      status: result.status === "failed" ? "failed" : "unavailable",
      message: result.message,
    };
  }
  return { ok: true, mime: result.mime, bytes: result.bytes, creates_canonical: false };
}
