/**
 * Turn a YouTube watch URL into a local media file.
 *
 * Mux cannot ingest a watch page. This module fetches the actual audio/video
 * bytes using InnerTube (youtubei.js) and, when present, yt-dlp.
 *
 * YouTube bot-gates datacenter IPs unless a signed-in session is supplied
 * via Netscape cookies / Cookie header (`YOUTUBE_COOKIES` or the ingest POST).
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { resolveYoutubeCookieInput } from "@/lib/media/youtube-cookies";
import { youtubeVideoIdFromUrl } from "@/lib/media/source-url";

export class YoutubeFileError extends Error {
  readonly code: "bot_gate" | "fetch_failed";
  constructor(code: "bot_gate" | "fetch_failed", message: string) {
    super(message);
    this.name = "YoutubeFileError";
    this.code = code;
  }
}

export const YOUTUBE_BOT_GATE_COPY =
  "YouTube blocked this ingest server from fetching the file (sign in to confirm you are not a bot). Mux cannot pull a watch page — it needs the media file. Paste cookies from a signed-in youtube.com session, or upload the file on Gallery. This did not create a Universe.";

export type YoutubeFileResult = {
  filePath: string;
  contentType: string;
  cleanup: () => Promise<void>;
};

function looksLikeBotGate(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("sign in to confirm") ||
    lower.includes("not a bot") ||
    lower.includes("login_required")
  );
}

async function which(bin: string): Promise<string | null> {
  const fromEnv = bin === "yt-dlp" ? process.env.YT_DLP_PATH?.trim() : "";
  if (fromEnv) return fromEnv;
  return new Promise((resolve) => {
    const child = spawn("which", [bin]);
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += String(chunk);
    });
    child.on("close", (code) => {
      const path = out.trim().split(/\n/)[0];
      resolve(code === 0 && path ? path : null);
    });
    child.on("error", () => resolve(null));
  });
}

function runCommand(bin: string, args: string[], timeoutMs: number): Promise<{ code: number; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new YoutubeFileError("fetch_failed", `YouTube file fetch timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stderr, stdout });
    });
  });
}

async function fetchWithYtDlp(input: {
  url: string;
  dir: string;
  cookieHeader: string | null;
  netscapeRaw: string | null;
}): Promise<string | null> {
  const ytDlp = await which("yt-dlp");
  if (!ytDlp) return null;
  const outTemplate = join(input.dir, "media.%(ext)s");
  const args = [
    "--no-playlist",
    "--no-warnings",
    "--merge-output-format",
    "mp4",
    "-f",
    "bv*+ba/b",
    "-o",
    outTemplate,
  ];
  const nodePath = process.execPath;
  if (nodePath) args.push("--js-runtimes", `node:${nodePath}`);
  let cookieFile: string | null = null;
  if (input.netscapeRaw) {
    cookieFile = join(input.dir, "cookies.txt");
    await writeFile(cookieFile, input.netscapeRaw, { mode: 0o600 });
    args.push("--cookies", cookieFile);
  } else if (input.cookieHeader) {
    cookieFile = join(input.dir, "cookies.txt");
    const netscape = cookieHeaderToNetscape(input.cookieHeader);
    await writeFile(cookieFile, netscape, { mode: 0o600 });
    args.push("--cookies", cookieFile);
  }
  args.push(input.url);
  const result = await runCommand(ytDlp, args, 240_000);
  if (result.code !== 0) {
    const detail = `${result.stderr}\n${result.stdout}`.trim();
    if (looksLikeBotGate(detail)) {
      throw new YoutubeFileError("bot_gate", YOUTUBE_BOT_GATE_COPY);
    }
    throw new YoutubeFileError(
      "fetch_failed",
      `yt-dlp could not fetch the YouTube file.${detail ? ` ${detail.slice(-800)}` : ""}`,
    );
  }
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(input.dir)).filter((name) => name.startsWith("media."));
  if (!files.length) {
    throw new YoutubeFileError("fetch_failed", "yt-dlp finished without writing a media file.");
  }
  return join(input.dir, files[0]);
}

function cookieHeaderToNetscape(header: string): string {
  const lines = ["# Netscape HTTP Cookie File", ""];
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    lines.push(`.youtube.com\tTRUE\t/\tTRUE\t0\t${name}\t${value}`);
  }
  return `${lines.join("\n")}\n`;
}

async function fetchWithInnertube(input: {
  videoId: string;
  dir: string;
  cookieHeader: string | null;
}): Promise<string> {
  const { Innertube } = await import("youtubei.js");
  const yt = await Innertube.create({
    cookie: input.cookieHeader ?? undefined,
    generate_session_locally: true,
  });
  const info = await yt.getBasicInfo(input.videoId);
  const status = info.playability_status?.status ?? "";
  const reason = info.playability_status?.reason ?? "";
  if (status === "LOGIN_REQUIRED" || looksLikeBotGate(`${status} ${reason}`)) {
    throw new YoutubeFileError("bot_gate", YOUTUBE_BOT_GATE_COPY);
  }
  if (status && status !== "OK") {
    throw new YoutubeFileError(
      "fetch_failed",
      `YouTube player status ${status}${reason ? `: ${reason}` : ""}. Mighty Verse will not invent a file.`,
    );
  }
  const stream = await yt.download(input.videoId, {
    type: "video+audio",
    quality: "best",
    format: "mp4",
  });
  const filePath = join(input.dir, "media.mp4");
  await pipeline(Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(filePath));
  return filePath;
}

function contentTypeFor(filePath: string): string {
  if (filePath.endsWith(".webm")) return "video/webm";
  if (filePath.endsWith(".mkv")) return "video/x-matroska";
  if (filePath.endsWith(".m4a")) return "audio/mp4";
  if (filePath.endsWith(".mp3")) return "audio/mpeg";
  return "video/mp4";
}

export async function materializeYoutubeFile(input: {
  url: string;
  cookies?: string | null;
}): Promise<YoutubeFileResult> {
  const videoId = youtubeVideoIdFromUrl(input.url);
  if (!videoId) {
    throw new YoutubeFileError("fetch_failed", "That YouTube URL is missing a video id.");
  }
  const rawCookies = input.cookies?.trim() || process.env.YOUTUBE_COOKIES?.trim() || "";
  const cookieHeader = resolveYoutubeCookieInput(input.cookies);
  const dir = await mkdtemp(join(tmpdir(), "mv-yt-"));
  const cleanup = async () => {
    await rm(dir, { recursive: true, force: true });
  };

  try {
    const ytDlpPath = await fetchWithYtDlp({
      url: input.url,
      dir,
      cookieHeader,
      netscapeRaw: rawCookies && rawCookies.includes("\t") ? rawCookies : null,
    }).catch((err) => {
      if (err instanceof YoutubeFileError && err.code === "bot_gate") throw err;
      return null;
    });
    if (ytDlpPath) {
      return { filePath: ytDlpPath, contentType: contentTypeFor(ytDlpPath), cleanup };
    }
    const filePath = await fetchWithInnertube({ videoId, dir, cookieHeader });
    return { filePath, contentType: contentTypeFor(filePath), cleanup };
  } catch (err) {
    await cleanup();
    if (err instanceof YoutubeFileError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    if (looksLikeBotGate(message)) throw new YoutubeFileError("bot_gate", YOUTUBE_BOT_GATE_COPY);
    throw new YoutubeFileError("fetch_failed", `Could not fetch the YouTube file. ${message}`);
  }
}

export { resolveYoutubeCookieInput };
