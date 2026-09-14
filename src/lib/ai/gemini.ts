/**
 * Gemini REST client — text, structured JSON, image, Veo long-running video.
 * Credentials stay server-side. Never import from client components.
 */

import { aiModelConfig, imageModelFallbacks, textModelFallbacks, videoModelFallbacks } from "./config";
import { classifyGeminiHttpError, unconfiguredFailure, type ProviderFailure } from "./errors";
import { geminiApiKey } from "./provider-key";
import { parseStructuredStoryboardJson, STORYBOARD_JSON_SCHEMA, type StructuredStoryboard } from "./structured-storyboard";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export type GeminiTextOk = {
  ok: true;
  provider: "gemini";
  text: string;
  model: string;
  creates_canonical: false;
};

export type GeminiImageOk = {
  ok: true;
  provider: "gemini";
  model: string;
  mime: string;
  bytes: Buffer;
  creates_canonical: false;
};

export type GeminiVideoSubmitOk = {
  ok: true;
  provider: "gemini";
  model: string;
  operationName: string;
  creates_canonical: false;
};

export type GeminiVideoStatus =
  | {
      ok: true;
      done: false;
      provider: "gemini";
    }
  | {
      ok: true;
      done: true;
      provider: "gemini";
      model: string;
      videoUri: string;
      bytes: Buffer;
      mime: string;
      hasAudio: boolean | null;
      creates_canonical: false;
    };

type GeminiPart = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
};

async function geminiFetch(path: string, init: RequestInit): Promise<Response> {
  const key = geminiApiKey();
  if (!key) throw new Error("unconfigured");
  const headers = new Headers(init.headers);
  headers.set("x-goog-api-key", key);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  return fetch(`${GEMINI_BASE}/${path.replace(/^\//, "")}`, { ...init, headers });
}

async function readError(response: Response): Promise<ProviderFailure> {
  const bodyText = await response.text().catch(() => "");
  return classifyGeminiHttpError({ httpStatus: response.status, bodyText });
}

export async function generateGeminiText(input: {
  system: string;
  prompt: string;
  model?: string;
}): Promise<GeminiTextOk | ProviderFailure> {
  const key = geminiApiKey();
  if (!key) return unconfiguredFailure();
  const models = input.model ? [input.model] : textModelFallbacks(aiModelConfig().textModel);
  let last: ProviderFailure | null = null;
  for (const model of models) {
    try {
      const response = await geminiFetch(`models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.system }] },
          contents: [{ role: "user", parts: [{ text: input.prompt }] }],
        }),
      });
      if (response.status === 404 || response.status === 403) {
        last = await readError(response);
        continue;
      }
      if (!response.ok) return readError(response);
      const payload = (await response.json()) as { candidates?: { content?: { parts?: GeminiPart[] } }[] };
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim() ?? "";
      if (!text) {
        last = {
          ok: false,
          code: "unknown",
          status: "failed",
          retryable: true,
          message: "Gemini returned empty text.",
          provider: "gemini",
        };
        continue;
      }
      return { ok: true, provider: "gemini", text, model, creates_canonical: false };
    } catch (caught) {
      if (caught instanceof Error && caught.message === "unconfigured") return unconfiguredFailure();
      last = {
        ok: false,
        code: "unknown",
        status: "failed",
        retryable: true,
        message: caught instanceof Error ? caught.message : "Gemini request failed.",
        provider: "gemini",
      };
    }
  }
  return last ?? {
    ok: false,
    code: "unsupported",
    status: "unavailable",
    retryable: false,
    message: "No configured Gemini text model accepted this request.",
    provider: "gemini",
  };
}

export async function generateStructuredStoryboard(input: {
  system: string;
  prompt: string;
}): Promise<{ ok: true; provider: "gemini"; model: string; storyboard: StructuredStoryboard; creates_canonical: false } | ProviderFailure> {
  const key = geminiApiKey();
  if (!key) return unconfiguredFailure();
  const models = textModelFallbacks(aiModelConfig().textModel);
  let last: ProviderFailure | null = null;
  for (const model of models) {
    try {
      const response = await geminiFetch(`models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.system }] },
          contents: [{ role: "user", parts: [{ text: input.prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: STORYBOARD_JSON_SCHEMA,
          },
        }),
      });
      if (response.status === 404 || response.status === 403) {
        last = await readError(response);
        continue;
      }
      if (!response.ok) {
        last = await readError(response);
        if (last.code === "unsupported") continue;
        return last;
      }
      const payload = (await response.json()) as { candidates?: { content?: { parts?: GeminiPart[] } }[] };
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim() ?? "";
      const storyboard = parseStructuredStoryboardJson(text);
      if (!storyboard) {
        last = {
          ok: false,
          code: "invalid_request",
          status: "failed",
          retryable: true,
          message: "Gemini returned storyboard JSON that could not be validated. Nothing was saved.",
          provider: "gemini",
        };
        continue;
      }
      return { ok: true, provider: "gemini", model, storyboard, creates_canonical: false };
    } catch (caught) {
      if (caught instanceof Error && caught.message === "unconfigured") return unconfiguredFailure();
      last = {
        ok: false,
        code: "unknown",
        status: "failed",
        retryable: true,
        message: caught instanceof Error ? caught.message : "Structured storyboard generation failed.",
        provider: "gemini",
      };
    }
  }
  return last ?? {
    ok: false,
    code: "unsupported",
    status: "unavailable",
    retryable: false,
    message: "No configured Gemini text model accepted structured storyboard generation.",
    provider: "gemini",
  };
}

export async function generateGeminiImageBytes(input: {
  prompt: string;
}): Promise<GeminiImageOk | ProviderFailure> {
  const key = geminiApiKey();
  if (!key) return unconfiguredFailure("Google Gemini image generation is not configured.");
  const models = imageModelFallbacks(aiModelConfig().imageModel);
  let last: ProviderFailure | null = null;
  for (const model of models) {
    try {
      const response = await geminiFetch(`models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: input.prompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      });
      if (response.status === 404 || response.status === 403) {
        last = await readError(response);
        continue;
      }
      if (!response.ok) return readError(response);
      const payload = (await response.json()) as { candidates?: { content?: { parts?: GeminiPart[] } }[] };
      const inline = payload.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
      if (!inline?.data) {
        last = {
          ok: false,
          code: "unknown",
          status: "failed",
          retryable: true,
          message: "Gemini image generation returned no image bytes.",
          provider: "gemini",
        };
        continue;
      }
      return {
        ok: true,
        provider: "gemini",
        model,
        mime: inline.mimeType ?? "image/png",
        bytes: Buffer.from(inline.data, "base64"),
        creates_canonical: false,
      };
    } catch (caught) {
      last = {
        ok: false,
        code: "unknown",
        status: "failed",
        retryable: true,
        message: caught instanceof Error ? caught.message : "Gemini image generation failed.",
        provider: "gemini",
      };
    }
  }
  return last ?? {
    ok: false,
    code: "unsupported",
    status: "unavailable",
    retryable: false,
    message: "No configured Gemini model can generate images.",
    provider: "gemini",
  };
}

export type VeoImageRef = { mime: string; bytes: Buffer };

export type VeoSubmitInput = {
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
  resolution?: "720p" | "1080p" | "4k";
  durationSeconds?: 4 | 6 | 8;
  generateAudio?: boolean;
  firstFrame?: VeoImageRef | null;
  lastFrame?: VeoImageRef | null;
  referenceImages?: VeoImageRef[];
  extensionVideoUri?: string | null;
};

function imagePayload(image: VeoImageRef) {
  return {
    mimeType: image.mime,
    bytesBase64Encoded: image.bytes.toString("base64"),
  };
}

export function veoRequestBody(input: VeoSubmitInput) {
  const instance: Record<string, unknown> = { prompt: input.prompt };
  if (input.extensionVideoUri) {
    instance.video = { uri: input.extensionVideoUri };
  } else if (input.referenceImages?.length) {
    instance.referenceImages = input.referenceImages.slice(0, 3).map((image) => ({
      referenceType: "asset",
      image: imagePayload(image),
    }));
  } else {
    if (input.firstFrame) instance.image = imagePayload(input.firstFrame);
    if (input.lastFrame) instance.lastFrame = imagePayload(input.lastFrame);
  }

  const durationSeconds = input.referenceImages?.length || (input.firstFrame && input.lastFrame)
    ? 8
    : input.durationSeconds ?? 8;
  const aspectRatio =
    input.referenceImages?.length && input.aspectRatio === "9:16" ? "16:9" : input.aspectRatio ?? "16:9";

  return {
    instances: [instance],
    parameters: {
      aspectRatio,
      resolution: input.resolution ?? "720p",
      durationSeconds,
      sampleCount: 1,
      ...(input.generateAudio === false ? { generateAudio: false } : { generateAudio: true }),
    },
  };
}

export async function submitVeoGeneration(input: VeoSubmitInput): Promise<GeminiVideoSubmitOk | ProviderFailure> {
  const key = geminiApiKey();
  if (!key) return unconfiguredFailure("Google Veo video generation is not configured.");
  const models = videoModelFallbacks(aiModelConfig().videoModel);
  let last: ProviderFailure | null = null;
  for (const model of models) {
    try {
      const response = await geminiFetch(`models/${encodeURIComponent(model)}:predictLongRunning`, {
        method: "POST",
        body: JSON.stringify(veoRequestBody(input)),
      });
      if (response.status === 404 || response.status === 403) {
        last = await readError(response);
        continue;
      }
      if (!response.ok) return readError(response);
      const payload = (await response.json()) as { name?: string };
      if (!payload.name) {
        last = {
          ok: false,
          code: "unknown",
          status: "failed",
          retryable: true,
          message: "Veo did not return an operation name.",
          provider: "gemini",
        };
        continue;
      }
      return { ok: true, provider: "gemini", model, operationName: payload.name, creates_canonical: false };
    } catch (caught) {
      last = {
        ok: false,
        code: "unknown",
        status: "failed",
        retryable: true,
        message: caught instanceof Error ? caught.message : "Veo submit failed.",
        provider: "gemini",
      };
    }
  }
  return last ?? {
    ok: false,
    code: "unsupported",
    status: "unavailable",
    retryable: false,
    message: "No configured Veo model accepted this request.",
    provider: "gemini",
  };
}

export async function pollVeoOperation(operationName: string): Promise<GeminiVideoStatus | ProviderFailure> {
  const key = geminiApiKey();
  if (!key) return unconfiguredFailure();
  const path = operationName.replace(/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\//, "");
  try {
    const response = await geminiFetch(path, { method: "GET" });
    if (!response.ok) return readError(response);
    const payload = (await response.json()) as {
      done?: boolean;
      error?: { message?: string };
      response?: {
        generateVideoResponse?: {
          generatedSamples?: { video?: { uri?: string; mimeType?: string }; raiMediaFilteredReasons?: string[] }[];
        };
      };
    };
    if (!payload.done) return { ok: true, done: false, provider: "gemini" };
    if (payload.error?.message) {
      return classifyGeminiHttpError({ httpStatus: 400, bodyText: JSON.stringify(payload.error) });
    }
    const sample = payload.response?.generateVideoResponse?.generatedSamples?.[0];
    const uri = sample?.video?.uri;
    if (!uri) {
      return {
        ok: false,
        code: "unknown",
        status: "failed",
        retryable: true,
        message: "Veo completed without a downloadable video URI.",
        provider: "gemini",
      };
    }
    const download = await fetch(uri, { headers: { "x-goog-api-key": key } });
    if (!download.ok) {
      return classifyGeminiHttpError({ httpStatus: download.status, bodyText: await download.text().catch(() => "") });
    }
    const bytes = Buffer.from(await download.arrayBuffer());
    const mime = sample?.video?.mimeType ?? download.headers.get("content-type") ?? "video/mp4";
    return {
      ok: true,
      done: true,
      provider: "gemini",
      model: aiModelConfig().videoModel,
      videoUri: uri,
      bytes,
      mime,
      hasAudio: null,
      creates_canonical: false,
    };
  } catch (caught) {
    return {
      ok: false,
      code: "unknown",
      status: "failed",
      retryable: true,
      message: caught instanceof Error ? caught.message : "Veo poll failed.",
      provider: "gemini",
    };
  }
}
