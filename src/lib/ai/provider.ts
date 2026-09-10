/**
 * Gemini API adapter for Storyboard assist and image generation.
 *
 * Chrome on-device Prompt API lives in `chrome.ts` and is preferred in the
 * curator browser. This module is the production-safe server fallback.
 * Neither writes canonical ontology. Unavailable is an honest status.
 */

export { STORYBOARD_SYSTEM } from "./chrome";

export type AiProviderId = "chrome-prompt" | "gemini" | "none";

export type AiCapability = {
  provider: AiProviderId;
  text: boolean;
  image: boolean;
  video: boolean;
  label: string;
};

export type AiTextResult =
  | { ok: true; provider: Exclude<AiProviderId, "none">; text: string; creates_canonical: false }
  | { ok: false; status: "unavailable" | "failed"; message: string; provider: AiProviderId };

export function geminiApiKey(): string | null {
  const key =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    "";
  return key || null;
}

export function serverAiCapability(): AiCapability {
  if (geminiApiKey()) {
    return {
      provider: "gemini",
      text: true,
      image: true,
      video: false,
      label: "Google Gemini API",
    };
  }
  return {
    provider: "none",
    text: false,
    image: false,
    video: false,
    label: "Google Gemini API is not configured.",
  };
}

export async function promptWithGemini(input: {
  system: string;
  prompt: string;
  model?: string;
}): Promise<AiTextResult> {
  const key = geminiApiKey();
  if (!key) {
    return { ok: false, status: "unavailable", message: "Google Gemini API is not configured.", provider: "none" };
  }
  const model = input.model ?? "gemini-2.0-flash";
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.system }] },
          contents: [{ role: "user", parts: [{ text: input.prompt }] }],
        }),
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status === 404 || response.status === 403 ? "unavailable" : "failed",
        message: `Gemini text generation failed (${response.status}).`,
        provider: "gemini",
      };
    }
    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim() ?? "";
    if (!text) {
      return { ok: false, status: "failed", message: "Gemini returned empty text.", provider: "gemini" };
    }
    return { ok: true, provider: "gemini", text, creates_canonical: false };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Gemini request failed.";
    return { ok: false, status: "failed", message, provider: "gemini" };
  }
}

export async function generateGeminiImage(input: {
  prompt: string;
}): Promise<
  | { ok: true; mime: string; bytes: Buffer; creates_canonical: false }
  | { ok: false; status: "unavailable" | "failed"; message: string }
> {
  const key = geminiApiKey();
  if (!key) {
    return { ok: false, status: "unavailable", message: "Google Gemini image generation is not configured." };
  }
  const models = ["gemini-2.5-flash-image", "gemini-2.0-flash-exp-image-generation"];
  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: input.prompt }] }],
            generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
          }),
        },
      );
      if (response.status === 404 || response.status === 403) continue;
      if (!response.ok) {
        return { ok: false, status: "failed", message: `Gemini image generation failed (${response.status}).` };
      }
      const payload = (await response.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
      };
      const inline = payload.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
      if (!inline?.data) continue;
      return {
        ok: true,
        mime: inline.mimeType ?? "image/png",
        bytes: Buffer.from(inline.data, "base64"),
        creates_canonical: false,
      };
    } catch {
      continue;
    }
  }
  return { ok: false, status: "unavailable", message: "No configured Gemini model can generate images." };
}
