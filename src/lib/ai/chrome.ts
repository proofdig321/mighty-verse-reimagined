/**
 * Chrome built-in Prompt API (Gemini Nano) for Storyboard assist.
 * Safe to import from client components.
 */

export type ChromeAiResult =
  | { ok: true; provider: "chrome-prompt"; text: string; creates_canonical: false }
  | { ok: false; status: "unavailable" | "failed"; message: string; provider: "chrome-prompt" | "none" };

type ChromeLanguageModel = {
  availability?: () => Promise<string>;
  create: (options?: { systemPrompt?: string; expectedInputs?: { type: string }[] }) => Promise<{
    prompt: (input: string) => Promise<string>;
    destroy?: () => void;
  }>;
};

function chromeLanguageModel(): ChromeLanguageModel | null {
  if (typeof globalThis === "undefined") return null;
  const root = globalThis as typeof globalThis & {
    LanguageModel?: ChromeLanguageModel;
    ai?: { languageModel?: ChromeLanguageModel };
  };
  return root.LanguageModel ?? root.ai?.languageModel ?? null;
}

export async function chromePromptAvailability(): Promise<{
  provider: "chrome-prompt" | "none";
  text: boolean;
  label: string;
}> {
  const model = chromeLanguageModel();
  if (!model) {
    return { provider: "none", text: false, label: "Chrome Prompt API is not available in this browser." };
  }
  try {
    const availability = typeof model.availability === "function" ? await model.availability() : "available";
    const ready = availability === "available" || availability === "readily";
    return {
      provider: ready ? "chrome-prompt" : "none",
      text: ready,
      label: ready ? "Chrome built-in Gemini Nano" : `Chrome Prompt API is ${availability}.`,
    };
  } catch {
    return { provider: "none", text: false, label: "Chrome Prompt API could not be initialised." };
  }
}

export async function promptWithChrome(input: {
  system: string;
  prompt: string;
}): Promise<ChromeAiResult> {
  const model = chromeLanguageModel();
  if (!model) {
    return { ok: false, status: "unavailable", message: "Chrome Prompt API is not available.", provider: "none" };
  }
  try {
    const session = await model.create({
      systemPrompt: input.system,
      expectedInputs: [{ type: "text" }],
    });
    const text = await session.prompt(input.prompt);
    session.destroy?.();
    if (!text?.trim()) {
      return { ok: false, status: "failed", message: "Chrome Prompt API returned empty text.", provider: "chrome-prompt" };
    }
    return { ok: true, provider: "chrome-prompt", text: text.trim(), creates_canonical: false };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Chrome Prompt API failed.";
    return { ok: false, status: "failed", message, provider: "chrome-prompt" };
  }
}

export const STORYBOARD_SYSTEM = `You are assisting a curator inside Mighty Verse Creative Studio.
Write or refine a storyboard story body for an existing Universe.
Do not invent canonical Scenes. Do not assign database identifiers.
Keep Scene relationships as creative proposals only.
Return plain story body text with one visual beat per line.
Optional camera/movement/transition lines may use "Camera:", "Movement:", or "Transition:" prefixes.`;
