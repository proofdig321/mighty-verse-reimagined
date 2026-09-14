/**
 * Honest Gemini / Veo error classification.
 * Quota and billing are provider states, not product architecture.
 */

export type ProviderErrorCode =
  | "unconfigured"
  | "auth"
  | "quota"
  | "rate_limit"
  | "safety"
  | "unsupported"
  | "invalid_request"
  | "timeout"
  | "storage"
  | "mux"
  | "database"
  | "unknown";

export type ProviderFailure = {
  ok: false;
  code: ProviderErrorCode;
  status: "failed" | "unavailable" | "blocked" | "needs_configuration";
  retryable: boolean;
  message: string;
  provider: "gemini" | "none";
  httpStatus?: number;
};

export function unconfiguredFailure(message = "Google Gemini API is not configured."): ProviderFailure {
  return {
    ok: false,
    code: "unconfigured",
    status: "needs_configuration",
    retryable: false,
    message,
    provider: "none",
  };
}

export function classifyGeminiHttpError(input: {
  httpStatus: number;
  bodyText?: string;
}): ProviderFailure {
  const body = (input.bodyText ?? "").slice(0, 4000);
  const lower = body.toLowerCase();
  const httpStatus = input.httpStatus;

  if (httpStatus === 401 || httpStatus === 403) {
    if (lower.includes("quota") || lower.includes("billing") || lower.includes("exceeded")) {
      return {
        ok: false,
        code: "quota",
        status: "unavailable",
        retryable: false,
        message: humanQuotaMessage(body, httpStatus),
        provider: "gemini",
        httpStatus,
      };
    }
    return {
      ok: false,
      code: "auth",
      status: "failed",
      retryable: false,
      message: `Gemini authentication failed (${httpStatus}).`,
      provider: "gemini",
      httpStatus,
    };
  }

  if (httpStatus === 429 || lower.includes("resource_exhausted") || lower.includes("quota")) {
    const rate = lower.includes("rate") || lower.includes("per minute") || lower.includes("throughput");
    return {
      ok: false,
      code: rate ? "rate_limit" : "quota",
      status: "unavailable",
      retryable: rate,
      message: humanQuotaMessage(body, httpStatus),
      provider: "gemini",
      httpStatus,
    };
  }

  if (httpStatus === 400 && (lower.includes("safety") || lower.includes("blocked") || lower.includes("prohibited"))) {
    return {
      ok: false,
      code: "safety",
      status: "blocked",
      retryable: false,
      message: "Generation was blocked by Gemini safety filters. Retry will not send the same request automatically.",
      provider: "gemini",
      httpStatus,
    };
  }

  if (httpStatus === 404 || lower.includes("not found") || lower.includes("not supported") || lower.includes("unsupported")) {
    return {
      ok: false,
      code: "unsupported",
      status: "unavailable",
      retryable: false,
      message: `The configured Gemini model rejected this request (${httpStatus}). The Storyboard capability remains; the provider/model does not currently accept this operation.`,
      provider: "gemini",
      httpStatus,
    };
  }

  if (httpStatus === 400) {
    return {
      ok: false,
      code: "invalid_request",
      status: "failed",
      retryable: false,
      message: extractGeminiMessage(body) ?? `Gemini rejected the request (${httpStatus}).`,
      provider: "gemini",
      httpStatus,
    };
  }

  return {
    ok: false,
    code: "unknown",
    status: "failed",
    retryable: httpStatus >= 500,
    message: extractGeminiMessage(body) ?? `Gemini request failed (${httpStatus}).`,
    provider: "gemini",
    httpStatus,
  };
}

function extractGeminiMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (typeof parsed.error?.message === "string" && parsed.error.message.trim()) {
      return parsed.error.message.trim();
    }
  } catch {
    /* raw body */
  }
  return null;
}

function humanQuotaMessage(body: string, httpStatus: number): string {
  const extracted = extractGeminiMessage(body);
  if (extracted?.toLowerCase().includes("quota") || extracted?.toLowerCase().includes("rate")) {
    return `Generation unavailable: ${extracted}`;
  }
  if (extracted) return `Generation unavailable: Gemini API quota or rate limit (${httpStatus}). ${extracted}`;
  return `Generation unavailable: Gemini API quota exceeded (${httpStatus}).`;
}
