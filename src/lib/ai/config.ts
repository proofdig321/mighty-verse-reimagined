/**
 * Server-side Gemini / Veo model configuration.
 *
 * Free-tier quota is a deployment constraint, not product architecture.
 * Model identifiers live here so Storyboard UI never hard-codes them.
 */

import { geminiApiKey } from "./provider-key";

export type AiMode =
  | "text"
  | "structured-storyboard"
  | "image"
  | "text-to-video"
  | "image-to-video"
  | "first-last-frame"
  | "reference-images"
  | "video-extension";

export type AiModelConfig = {
  textModel: string;
  imageModel: string;
  videoModel: string;
  configured: boolean;
};

export function aiModelConfig(): AiModelConfig {
  return {
    textModel: process.env.GEMINI_TEXT_MODEL?.trim() || "gemini-2.5-flash",
    imageModel: process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image",
    videoModel: process.env.GEMINI_VIDEO_MODEL?.trim() || "veo-3.1-generate-preview",
    configured: Boolean(geminiApiKey()),
  };
}

function uniqueModels(primary: string, extras: string[]): string[] {
  return [primary, ...extras.filter((model) => model && model !== primary)];
}

export function textModelFallbacks(primary: string): string[] {
  return uniqueModels(primary, [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-flash-latest",
  ]);
}

export function imageModelFallbacks(primary: string): string[] {
  return uniqueModels(primary, [
    "gemini-2.5-flash-image",
    "gemini-2.5-flash-preview-image",
    "gemini-3.1-flash-image",
    "gemini-2.0-flash-exp-image-generation",
  ]);
}

export function videoModelFallbacks(primary: string): string[] {
  return uniqueModels(primary, [
    "veo-3.1-generate-preview",
    "veo-3.1-lite-generate-preview",
    "veo-3.1-fast-generate-preview",
  ]);
}

export type AiServiceCapability = {
  provider: "gemini" | "none";
  label: string;
  configured: boolean;
  text: boolean;
  image: boolean;
  video: boolean;
  models: { text: string; image: string; video: string };
  modes: Record<AiMode, { available: boolean; reason: string | null }>;
};

function mode(available: boolean, reason: string | null) {
  return { available, reason };
}

export function aiServiceCapability(): AiServiceCapability {
  const config = aiModelConfig();
  if (!config.configured) {
    const reason = "Google Gemini API is not configured.";
    return {
      provider: "none",
      label: reason,
      configured: false,
      text: false,
      image: false,
      video: false,
      models: { text: config.textModel, image: config.imageModel, video: config.videoModel },
      modes: {
        text: mode(false, reason),
        "structured-storyboard": mode(false, reason),
        image: mode(false, reason),
        "text-to-video": mode(false, reason),
        "image-to-video": mode(false, reason),
        "first-last-frame": mode(false, reason),
        "reference-images": mode(false, reason),
        "video-extension": mode(false, reason),
      },
    };
  }
  return {
    provider: "gemini",
    label: "Google Gemini API",
    configured: true,
    text: true,
    image: true,
    video: true,
    models: { text: config.textModel, image: config.imageModel, video: config.videoModel },
    modes: {
      text: mode(true, null),
      "structured-storyboard": mode(true, null),
      image: mode(true, null),
      "text-to-video": mode(true, null),
      "image-to-video": mode(true, null),
      "first-last-frame": mode(true, null),
      "reference-images": mode(true, null),
      "video-extension": mode(true, null),
    },
  };
}
