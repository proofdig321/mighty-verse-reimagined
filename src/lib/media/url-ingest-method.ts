/**
 * Mux URL ingest method.
 *
 * Mux Create Asset `inputs[].url` must be a directly downloadable media file
 * (MP4/MOV/MKV/TS or audio). A YouTube watch page is HTML. Sending it to Mux
 * yields `invalid_input`: "The input file was not a valid video or audio file."
 *
 * YouTube therefore has to become a local file, then Mux Direct Upload.
 * Direct HTTPS media URLs still use Mux URL pull.
 */

export type MuxUrlIngestMethod = "youtube-file" | "mux-url-pull";

export function decideMuxUrlIngestMethod(kind: "youtube" | "direct" | string): MuxUrlIngestMethod {
  return kind === "youtube" ? "youtube-file" : "mux-url-pull";
}
