"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import type { GenerationJobKind } from "@/lib/ai/jobs";

export type OutputFormat = {
  kind: GenerationJobKind;
  label: string;
  shortLabel: string;
  description: string;
  requiresImage: boolean;
  requiresVideo: boolean;
  requiresText: boolean;
  group: "image" | "video" | "short" | "animation";
};

export const OUTPUT_FORMATS: OutputFormat[] = [
  // Image
  { kind: "still", label: "Still Image", shortLabel: "Still", description: "Single frame from directive or reference", requiresImage: false, requiresVideo: false, requiresText: true, group: "image" },
  // Video
  { kind: "motion", label: "Video Clip", shortLabel: "Clip", description: "Full video from text directive", requiresImage: false, requiresVideo: false, requiresText: true, group: "video" },
  { kind: "animate-still", label: "Animate Still", shortLabel: "Animate", description: "Bring a still image to life", requiresImage: true, requiresVideo: false, requiresText: false, group: "video" },
  { kind: "first-last-frame", label: "First → Last Frame", shortLabel: "F→L Frame", description: "Interpolate between two frames", requiresImage: true, requiresVideo: false, requiresText: false, group: "video" },
  { kind: "reference-motion", label: "Reference Motion", shortLabel: "Ref Motion", description: "Motion guided by reference frames", requiresImage: true, requiresVideo: false, requiresText: false, group: "video" },
  { kind: "extend", label: "Extend Clip", shortLabel: "Extend", description: "Continue an existing video clip", requiresImage: false, requiresVideo: true, requiresText: false, group: "video" },
  // Short-form
  { kind: "reel", label: "Reel", shortLabel: "Reel", description: "Short-form vertical reel", requiresImage: false, requiresVideo: false, requiresText: true, group: "short" },
  { kind: "gif", label: "GIF", shortLabel: "GIF", description: "Looping animated GIF", requiresImage: false, requiresVideo: false, requiresText: true, group: "short" },
  // Animation
  { kind: "animation", label: "Animation", shortLabel: "Anim", description: "Cinematic animation style", requiresImage: false, requiresVideo: false, requiresText: true, group: "animation" },
];

const GROUPS: { id: OutputFormat["group"]; label: string }[] = [
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
  { id: "short", label: "Short-form" },
  { id: "animation", label: "Animation" },
];

type Capability = {
  provider: string;
  configured: boolean;
  text?: boolean;
  image?: boolean;
  video?: boolean;
} | null;

function isFormatAvailable(fmt: OutputFormat, capability: Capability, hasStill: boolean, hasMotion: boolean): boolean {
  if (!capability?.configured) return false;
  if (fmt.requiresImage && !hasStill) return false;
  if (fmt.requiresVideo && !hasMotion) return false;
  if (fmt.group === "image") return Boolean(capability.image || capability.text);
  if (fmt.group === "animation") return Boolean(capability.video);
  if (fmt.group === "short") return Boolean(capability.video);
  return Boolean(capability.video);
}

export function OutputFormatPicker({
  selected,
  onSelect,
  capability,
  hasStill,
  hasMotion,
  aspectRatio,
  onSetAspect,
  durationSeconds,
  onSetDuration,
  firstFrame,
  lastFrame,
  onSetFirstFrame,
  onSetLastFrame,
  onGenerate,
  generateDisabled,
  generateTitle,
  workFrames,
}: {
  selected: GenerationJobKind;
  onSelect: (kind: GenerationJobKind) => void;
  capability: Capability;
  hasStill: boolean;
  hasMotion: boolean;
  aspectRatio: "16:9" | "9:16";
  onSetAspect: (v: "16:9" | "9:16") => void;
  durationSeconds: 4 | 6 | 8;
  onSetDuration: (v: 4 | 6 | 8) => void;
  firstFrame: string;
  lastFrame: string;
  onSetFirstFrame: (url: string) => void;
  onSetLastFrame: (url: string) => void;
  onGenerate: () => void;
  generateDisabled?: boolean;
  generateTitle?: string;
  workFrames: { source_title: string; timestamp_ms: number; still_url: string; panel_id: string | null }[];
}) {
  const selectedFmt = OUTPUT_FORMATS.find((f) => f.kind === selected) ?? OUTPUT_FORMATS[0];
  const isVideo = selectedFmt.group === "video" || selectedFmt.group === "short" || selectedFmt.group === "animation";
  const needsFirstLast = selected === "first-last-frame";
  const needsFirstFrame = selected === "animate-still" || selected === "reference-motion";

  return (
    <div className="space-y-3">
      {/* Format groups */}
      <div className="space-y-2">
        {GROUPS.map((group) => {
          const formats = OUTPUT_FORMATS.filter((f) => f.group === group.id);
          return (
            <div key={group.id}>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1.5">{group.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {formats.map((fmt) => {
                  const available = isFormatAvailable(fmt, capability, hasStill, hasMotion);
                  const isSelected = selected === fmt.kind;
                  return (
                    <button
                      key={fmt.kind}
                      type="button"
                      disabled={!available}
                      title={available ? fmt.description : `${fmt.description}${fmt.requiresImage ? " — requires a still" : ""}${fmt.requiresVideo ? " — requires a clip" : ""}${!capability?.configured ? " — provider not configured" : ""}`}
                      onClick={() => onSelect(fmt.kind)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                        isSelected
                          ? "border-primary bg-primary/20 text-foreground"
                          : available
                          ? "border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground"
                          : "border-border/30 bg-transparent text-muted-foreground/40 cursor-not-allowed",
                      )}
                    >
                      {fmt.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-format controls */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40">
        {/* Aspect ratio — all formats */}
        <select
          aria-label="Aspect ratio"
          className="h-7 rounded-full border border-border bg-background px-2.5 text-xs text-foreground"
          value={aspectRatio}
          onChange={(e) => onSetAspect(e.target.value === "9:16" ? "9:16" : "16:9")}
        >
          <option value="16:9">16:9 Landscape</option>
          <option value="9:16">9:16 Portrait</option>
          <option value="1:1">1:1 Square</option>
          <option value="4:5">4:5 Feed</option>
        </select>

        {/* Duration — video/short/animation */}
        {isVideo && (
          <select
            aria-label="Duration"
            className="h-7 rounded-full border border-border bg-background px-2.5 text-xs text-foreground"
            value={durationSeconds}
            onChange={(e) => onSetDuration(Number(e.target.value) as 4 | 6 | 8)}
          >
            <option value={4}>4s</option>
            <option value={6}>6s</option>
            <option value={8}>8s</option>
          </select>
        )}

        {/* First frame picker — animate-still, reference-motion */}
        {needsFirstFrame && workFrames.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Start frame:</span>
            <div className="flex gap-1">
              {workFrames.slice(0, 6).map((frame, i) => (
                <button
                  key={i}
                  type="button"
                  title={`${frame.source_title}`}
                  onClick={() => onSetFirstFrame(frame.still_url)}
                  className={cn(
                    "w-8 h-5 rounded overflow-hidden border transition-colors",
                    firstFrame === frame.still_url ? "border-primary" : "border-border/50 hover:border-border",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={frame.still_url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* First + last frame pickers — first-last-frame */}
        {needsFirstLast && workFrames.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">First:</span>
              <div className="flex gap-1">
                {workFrames.slice(0, 4).map((frame, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSetFirstFrame(frame.still_url)}
                    className={cn(
                      "w-8 h-5 rounded overflow-hidden border transition-colors",
                      firstFrame === frame.still_url ? "border-primary" : "border-border/50 hover:border-border",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={frame.still_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Last:</span>
              <div className="flex gap-1">
                {workFrames.slice(0, 4).map((frame, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSetLastFrame(frame.still_url)}
                    className={cn(
                      "w-8 h-5 rounded overflow-hidden border transition-colors",
                      lastFrame === frame.still_url ? "border-primary" : "border-border/50 hover:border-border",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={frame.still_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Provider label */}
        {capability && (
          <span className="text-[10px] text-muted-foreground ml-auto">{capability.provider}</span>
        )}

        {/* Generate button */}
        <Button
          type="button"
          size="sm"
          disabled={generateDisabled}
          title={generateTitle ?? `Generate ${selectedFmt.label}`}
          onClick={onGenerate}
          className="h-8 gap-1.5 ml-auto"
        >
          <Sparkles size={13} />
          {selectedFmt.shortLabel}
        </Button>
      </div>
    </div>
  );
}
