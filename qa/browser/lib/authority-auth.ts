import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { BrowserContext } from "@playwright/test";

const MAX_CHUNK_SIZE = 3180;

function readLocalEnv(): Record<string, string> {
  const candidates = [resolve(process.cwd(), ".env.local"), resolve(process.cwd(), "../../.env.local")];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) return {};
  const parsed: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key && parsed[key] == null) parsed[key] = value;
  }
  return parsed;
}

function createChunks(key: string, value: string): { name: string; value: string }[] {
  const encodedValue = encodeURIComponent(value);
  if (encodedValue.length <= MAX_CHUNK_SIZE) return [{ name: key, value }];
  const chunks: string[] = [];
  let remaining = encodedValue;
  while (remaining.length > 0) {
    let head = remaining.slice(0, MAX_CHUNK_SIZE);
    const lastEscape = head.lastIndexOf("%");
    if (lastEscape > MAX_CHUNK_SIZE - 3) head = head.slice(0, lastEscape);
    chunks.push(decodeURIComponent(head));
    remaining = remaining.slice(head.length);
  }
  return chunks.map((chunk, index) => ({ name: `${key}.${index}`, value: chunk }));
}

/**
 * Establish an Authority session using the already-configured Supabase service
 * role. Does not invent credentials and does not write canonical product data.
 */
export async function applyAuthoritySession(context: BrowserContext, origin: string): Promise<void> {
  const localEnv = readLocalEnv();
  const supabaseUrl = [localEnv.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL]
    .map((value) => value?.trim())
    .find((value) => value && /^https?:\/\//i.test(value));
  const serviceKey = [localEnv.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY]
    .map((value) => value?.trim())
    .find((value) => value && value.length > 20);
  const email = process.env.QA_AUTHORITY_EMAIL ?? localEnv.QA_AUTHORITY_EMAIL ?? "info@unamifoundation.org";

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Authority browser QA needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const hashedToken = linkData.properties?.hashed_token;
  if (linkError || !hashedToken) {
    throw new Error(`Authority session was not created (${linkError?.message ?? "missing token"}).`);
  }

  const { data: sessionData, error: otpError } = await admin.auth.verifyOtp({
    type: "email",
    token_hash: hashedToken,
  });
  if (otpError || !sessionData.session) {
    throw new Error(`Authority session was not verified (${otpError?.message ?? "missing session"}).`);
  }

  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const encoded = `base64-${Buffer.from(JSON.stringify(sessionData.session), "utf8").toString("base64url")}`;
  const cookieOrigin = new URL(origin);
  const domain = cookieOrigin.hostname;

  await context.addCookies(
    createChunks(storageKey, encoded).map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain,
      path: "/",
      httpOnly: false,
      secure: cookieOrigin.protocol === "https:",
      sameSite: "Lax" as const,
    })),
  );
}
