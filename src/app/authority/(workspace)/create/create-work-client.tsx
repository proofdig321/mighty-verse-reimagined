"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api, responseData } from "../_shared/authority-utils";

type Universe = { master_id: string; title: string | null };
type Mural = { master_id: string; parent_master_id: string | null; title: string | null };
type Participant = { participant_id: string; label: string; is_self: boolean };

type Props = {
  universes: Universe[];
  murals: Mural[];
  participants: Participant[];
  currentParticipantId: string;
};

type WorkType = "universe" | "mural" | "scene" | "creative-moment";

const TYPE_LABELS: Record<WorkType, string> = {
  universe: "Universe",
  mural: "Mural",
  scene: "Scene",
  "creative-moment": "Creative Moment",
};

const TYPE_DESCRIPTIONS: Record<WorkType, string> = {
  universe: "A top-level creative world. Contains Murals and Creative Moments.",
  mural: "A canonical audiovisual work within a Universe. Contains Scenes.",
  scene: "A canonical segment of a Mural with its own identity and timing.",
  "creative-moment": "A canonical creative moment — a participant's contribution within a Universe.",
};

// Types that can have a video attached during creation
const HAS_MEDIA: WorkType[] = ["universe", "mural"];

type Step = "type" | "placement" | "identity" | "media" | "review" | "creating" | "done";

const STEP_LABELS: Record<Step, string> = {
  type: "Type",
  placement: "Placement",
  identity: "Identity",
  media: "Media",
  review: "Review",
  creating: "Creating",
  done: "Done",
};

const VISIBLE_STEPS: Step[] = ["type", "placement", "identity", "media", "review"];

export default function CreateWorkClient({ universes, murals, participants, currentParticipantId }: Props) {
  const router = useRouter();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("type");
  const [workType, setWorkType] = useState<WorkType>("universe");
  const [parentMasterId, setParentMasterId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectionType, setProjectionType] = useState("experiential");

  // Media
  const [hasVideo, setHasVideo] = useState(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [rightsHolderRef, setRightsHolderRef] = useState(currentParticipantId);
  const [rightsBasis, setRightsBasis] = useState("owned");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progress / result
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusLine, setStatusLine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdMasterId, setCreatedMasterId] = useState<string | null>(null);

  const needsParent = workType === "mural" || workType === "scene" || workType === "creative-moment";
  const canHaveMedia = HAS_MEDIA.includes(workType);

  const parentOptions: (Universe | Mural)[] =
    workType === "mural" || workType === "creative-moment"
      ? universes
      : workType === "scene"
      ? murals
      : [];

  // ── Step navigation ─────────────────────────────────────────────────────────
  function stepsFor(type: WorkType): Step[] {
    const base: Step[] = ["type"];
    if (type === "mural" || type === "scene" || type === "creative-moment") base.push("placement");
    base.push("identity");
    if (HAS_MEDIA.includes(type)) base.push("media");
    base.push("review");
    return base;
  }

  function nextStep() {
    const steps = stepsFor(workType);
    const idx = steps.indexOf(step);
    if (idx < steps.length - 1) setStep(steps[idx + 1]);
  }

  function prevStep() {
    const steps = stepsFor(workType);
    const idx = steps.indexOf(step);
    if (idx > 0) setStep(steps[idx - 1]);
  }

  // ── Creation ────────────────────────────────────────────────────────────────
  async function createWork() {
    setStep("creating");
    setError(null);
    setUploadProgress(0);

    try {
      // 1. Register master
      setStatusLine("Registering work…");
      const masterRes = await api("/api/authority/masters", {
        canonical_type: workType,
        parent_master_id: parentMasterId || null,
        title: title.trim() || null,
        description: description.trim() || null,
      });
      if (masterRes.error) throw new Error(masterRes.error);
      const masterId: string = masterRes.master_id;
      setCreatedMasterId(masterId);

      // 2. Authorise canonical state
      setStatusLine("Authorising canonical state…");
      const stateRes = await api("/api/authority/states", { master_id: masterId });
      if (stateRes.error) throw new Error(stateRes.error);

      // 3. Create projection
      setStatusLine("Creating experience…");
      const projRes = await api("/api/authority/projections", {
        canonical_state_id: stateRes.canonical_state_id,
        master_id: masterId,
        projection_type: projectionType,
      });
      if (projRes.error) throw new Error(projRes.error);
      const projectionId: string = projRes.projection_id;

      // 4. Upload + attach video (if provided)
      if (canHaveMedia && hasVideo && videoFile) {
        setStatusLine("Starting upload session…");
        const session = await api("/api/authority/media/upload-session", {
          name: videoFile.name,
          projection_id: projectionId,
          master_id: masterId,
          intake_id: null,
        });
        if (session.error || !session.upload_url || !session.asset_id) {
          throw new Error(session.error ?? "Upload session failed");
        }

        setStatusLine("Uploading video…");
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
          xhr.onerror = () => reject(new Error("Network error during upload"));
          xhr.open("PUT", session.upload_url);
          xhr.send(videoFile);
        });

        setStatusLine("Processing video…");
        let phase = "uploading";
        for (let i = 0; phase !== "ready" && i < 120; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          const s = await fetch(`/api/authority/media/upload-session/${session.asset_id}`).then(responseData);
          if (s.error) throw new Error(s.error);
          phase = s.phase ?? "unknown";
          if (phase === "failed") throw new Error("Livepeer processing failed");
          setStatusLine(`Processing video… (${phase})`);
        }
        if (phase !== "ready") throw new Error("Video processing timed out");

        setStatusLine("Attaching media…");
        const attach = await api("/api/authority/media", {
          projection_id: projectionId,
          master_id: masterId,
          livepeer_asset_id: session.asset_id,
          rights_holder_ref: rightsHolderRef,
          rights_basis: rightsBasis,
          intake_id: null,
          session_id: session.session_id ?? null,
        });
        if (attach.error) throw new Error(attach.error);
      }

      setStatusLine("Done.");
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creation failed");
      setStep("review"); // return to review so they can retry
    }
  }

  // ── Done screen ─────────────────────────────────────────────────────────────
  if (step === "done" && createdMasterId) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-8 max-w-lg mx-auto text-center px-4">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full text-3xl"
          style={{ background: "color-mix(in oklch, var(--accent-mv-gold) 15%, var(--card))", border: "2px solid var(--accent-mv-gold)" }}
        >
          ✓
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--accent-mv-gold)" }}>
            {TYPE_LABELS[workType]} Created
          </h1>
          <p className="text-base text-foreground font-medium">{title.trim() || "Untitled"}</p>
          <p className="text-sm text-muted-foreground">
            Canonical state authorised · Projection created
            {canHaveMedia && hasVideo && videoFile ? " · Video attached" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button size="lg" onClick={() => router.push(`/authority/${createdMasterId}`)}>
            Open work →
          </Button>
          <Button size="lg" variant="outline" onClick={() => {
            setStep("type"); setTitle(""); setDescription(""); setParentMasterId("");
            setVideoFile(null); setRightsHolderRef(currentParticipantId); setRightsBasis("owned");
            setHasVideo(true); setCreatedMasterId(null); setError(null);
          }}>
            Create another
          </Button>
        </div>
      </div>
    );
  }

  // ── Creating screen ─────────────────────────────────────────────────────────
  if (step === "creating") {
    const ALL_STAGES = [
      { key: "register",   label: "Registering work" },
      { key: "state",      label: "Authorising canonical state" },
      { key: "projection", label: "Creating projection" },
      { key: "session",    label: "Starting upload session" },
      { key: "upload",     label: "Uploading video" },
      { key: "process",    label: "Processing video" },
      { key: "attach",     label: "Attaching media" },
    ];
    const stages = canHaveMedia && hasVideo && videoFile ? ALL_STAGES : ALL_STAGES.slice(0, 3);
    const s = statusLine.toLowerCase();
    const stageIdx = s.includes("attaching") ? stages.length - 1
      : s.includes("processing") ? stages.findIndex(x => x.key === "process")
      : s.includes("uploading")  ? stages.findIndex(x => x.key === "upload")
      : s.includes("starting")   ? stages.findIndex(x => x.key === "session")
      : s.includes("creating")   ? stages.findIndex(x => x.key === "projection")
      : s.includes("authoris")   ? stages.findIndex(x => x.key === "state")
      : 0;
    const isUploading  = s.includes("uploading");
    const isProcessing = s.includes("processing");
    const processPhase = statusLine.match(/\(([^)]+)\)/)?.[1];

    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-8 max-w-lg mx-auto px-4">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <svg className="absolute inset-0 h-full w-full animate-spin" viewBox="0 0 96 96" fill="none">
            <circle cx="48" cy="48" r="44" stroke="var(--border)" strokeWidth="4" />
            <path d="M48 4 A44 44 0 0 1 92 48" stroke="var(--accent-mv)" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <span className="text-2xl">⚡</span>
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Creating {TYPE_LABELS[workType]}…</h1>
          <p className="text-sm text-muted-foreground">{title.trim() || "Untitled"}</p>
        </div>

        <div className="w-full space-y-2">
          {stages.map((stage, i) => {
            const done   = i < stageIdx;
            const active = i === stageIdx;
            return (
              <div
                key={stage.key}
                className="flex items-center gap-3 rounded-lg px-4 py-3 transition-all"
                style={{
                  background: active ? "color-mix(in oklch, var(--accent-mv) 12%, var(--card))" : "var(--card)",
                  border: `1px solid ${active ? "color-mix(in oklch, var(--accent-mv) 50%, transparent)" : "var(--border)"}`,
                  opacity: i > stageIdx ? 0.35 : 1,
                }}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    background: done ? "var(--accent-mv)" : active ? "color-mix(in oklch, var(--accent-mv) 25%, var(--card))" : "var(--muted)",
                    color: done ? "#fff" : active ? "var(--accent-mv)" : "var(--muted-foreground)",
                    border: active ? "1px solid var(--accent-mv)" : "none",
                  }}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className="text-sm flex-1" style={{ color: active ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: active ? 500 : 400 }}>
                  {stage.label}
                  {active && isProcessing && processPhase && (
                    <span className="ml-2 text-xs" style={{ color: "var(--accent-mv)" }}>({processPhase})</span>
                  )}
                </span>
                {active && !isUploading && (
                  <span className="text-xs animate-pulse" style={{ color: "var(--accent-mv)" }}>●</span>
                )}
              </div>
            );
          })}
        </div>

        {isUploading && (
          <div className="w-full space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Uploading video</span>
              <span className="font-semibold" style={{ color: "var(--accent-mv)" }}>{uploadProgress}%</span>
            </div>
            <div className="h-3 w-full rounded-full overflow-hidden" style={{ background: "var(--muted)" }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%`, background: "linear-gradient(90deg, var(--accent-mv), var(--accent-mv-gold))" }}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">
              {uploadProgress < 100 ? "Do not close this page" : "Upload complete — processing…"}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Visible step index for progress bar ─────────────────────────────────────
  const activeSteps = stepsFor(workType);
  const stepIdx = activeSteps.indexOf(step);

  return (
    <div className="space-y-10 max-w-xl">

      {/* Header */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Authority</p>
        <h1 className="text-3xl font-semibold tracking-tight">Create Work</h1>
        <p className="text-sm text-muted-foreground">
          Register a new creative work in the Mighty Verse canonical hierarchy.
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-1.5">
        {activeSteps.map((s, i) => {
          const done = i < stepIdx;
          const current = i === stepIdx;
          return (
            <div key={s} className="flex items-center gap-1.5">
              {i > 0 && <div className="h-px w-5 bg-border" />}
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${done ? "bg-emerald-500 text-emerald-950" : current ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
                {done ? "✓" : i + 1}
              </div>
              <span className={`text-xs hidden sm:inline ${current ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {STEP_LABELS[s]}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Step: Type ─────────────────────────────────────────────────────── */}
      {step === "type" && (
        <div className="space-y-5">
          <p className="text-sm font-medium text-foreground">What are you creating?</p>
          <div className="grid grid-cols-2 gap-2">
            {(["universe", "mural", "scene", "creative-moment"] as WorkType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setWorkType(t)}
                className={`rounded-lg border px-4 py-4 text-left transition-colors ${workType === t ? "border-[var(--accent-mv)] bg-accent/30" : "border-border hover:border-[var(--accent-mv)]/50"}`}
              >
                <p className="text-sm font-medium text-foreground">{TYPE_LABELS[t]}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-snug">{TYPE_DESCRIPTIONS[t]}</p>
              </button>
            ))}
          </div>
          <Button onClick={nextStep}>Continue →</Button>
        </div>
      )}

      {/* ── Step: Placement ────────────────────────────────────────────────── */}
      {step === "placement" && (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {workType === "scene" ? "Which Mural does this Scene belong to?" : "Which Universe does this belong to?"}
            </p>
            <p className="text-xs text-muted-foreground">
              {workType === "mural" && "This Mural will be a canonical audiovisual work within the selected Universe."}
              {workType === "scene" && "This Scene will be a canonical segment within the selected Mural."}
              {workType === "creative-moment" && "This Creative Moment will belong to the selected Universe."}
            </p>
            <select
              value={parentMasterId}
              onChange={(e) => setParentMasterId(e.target.value)}
              className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {parentOptions.map((p) => (
                <option key={p.master_id} value={p.master_id}>
                  {p.title ?? p.master_id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={prevStep}>← Back</Button>
            <Button disabled={!parentMasterId} onClick={nextStep}>Continue →</Button>
          </div>
        </div>
      )}

      {/* ── Step: Identity ─────────────────────────────────────────────────── */}
      {step === "identity" && (
        <div className="space-y-5">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Title <span className="text-muted-foreground font-normal">(required)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${TYPE_LABELS[workType]} title`}
                autoFocus
                className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description shown on the public page"
                rows={3}
                className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Experience type</label>
              <select
                value={projectionType}
                onChange={(e) => setProjectionType(e.target.value)}
                className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="experiential">Experiential — public interactive experience</option>
                <option value="distributional">Distributional — distribution copy</option>
                <option value="archival">Archival — preservation record</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={prevStep}>← Back</Button>
            <Button disabled={!title.trim()} onClick={nextStep}>Continue →</Button>
          </div>
        </div>
      )}

      {/* ── Step: Media ────────────────────────────────────────────────────── */}
      {step === "media" && (
        <div className="space-y-5">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <input
                id="has-video"
                type="checkbox"
                checked={hasVideo}
                onChange={(e) => { setHasVideo(e.target.checked); if (!e.target.checked) setVideoFile(null); }}
                className="mt-0.5 h-4 w-4 rounded border-border"
              />
              <div>
                <label htmlFor="has-video" className="text-sm font-medium text-foreground cursor-pointer">
                  Attach a video now
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  You can also attach video later from the work detail page.
                </p>
              </div>
            </div>

            {hasVideo && (
              <div className="space-y-4 rounded-lg border border-border bg-card/40 px-4 py-4">

                {/* File picker */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Video file</label>
                  <div
                    className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors cursor-pointer ${videoFile ? "border-[var(--accent-mv)]/60 bg-accent/10" : "border-border hover:border-[var(--accent-mv)]/40"}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const f = e.dataTransfer.files[0];
                      if (f && f.type.startsWith("video/")) setVideoFile(f);
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/mp4,video/*"
                      className="sr-only"
                      onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                    />
                    {videoFile ? (
                      <>
                        <span className="text-2xl">🎬</span>
                        <p className="text-sm font-medium text-foreground">{videoFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setVideoFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl opacity-30">📹</span>
                        <p className="text-sm text-muted-foreground">Click or drag a video file here</p>
                        <p className="text-xs text-muted-foreground/60">MP4 recommended</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Rights holder */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Rights holder</label>
                  <p className="text-xs text-muted-foreground">Who owns or controls the rights to this video?</p>
                  <select
                    value={rightsHolderRef}
                    onChange={(e) => setRightsHolderRef(e.target.value)}
                    className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="">Select rights holder…</option>
                    {participants.map((p) => (
                      <option key={p.participant_id} value={p.participant_id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rights basis */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Rights basis</label>
                  <p className="text-xs text-muted-foreground">How does the rights holder hold rights to this video?</p>
                  <select
                    value={rightsBasis}
                    onChange={(e) => setRightsBasis(e.target.value)}
                    className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="owned">Owned — original work, all rights held</option>
                    <option value="licensed">Licensed — rights licensed from third party</option>
                    <option value="commissioned">Commissioned — work for hire / commissioned</option>
                    <option value="co-owned">Co-owned — jointly held rights</option>
                    <option value="other">Other</option>
                  </select>
                  {rightsBasis === "other" && (
                    <input
                      type="text"
                      placeholder="Describe the rights basis"
                      className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm mt-1.5"
                      onChange={(e) => setRightsBasis(e.target.value || "other")}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={prevStep}>← Back</Button>
            <Button
              disabled={hasVideo && (!videoFile || !rightsHolderRef || !rightsBasis)}
              onClick={nextStep}
            >
              Continue →
            </Button>
          </div>
        </div>
      )}

      {/* ── Step: Review ───────────────────────────────────────────────────── */}
      {step === "review" && (
        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-card/50 divide-y divide-border overflow-hidden">
            <div className="px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Review</p>
              <div className="space-y-2.5 text-sm">
                <Row label="Type" value={TYPE_LABELS[workType]} />
                {parentMasterId && (
                  <Row
                    label={workType === "scene" ? "Mural" : "Universe"}
                    value={parentOptions.find((p) => p.master_id === parentMasterId)?.title ?? parentMasterId.slice(0, 8)}
                  />
                )}
                <Row label="Title" value={title.trim() || <span className="italic text-muted-foreground">Untitled</span>} />
                {description.trim() && <Row label="Description" value={description.trim()} />}
                <Row label="Experience" value={projectionType} />
              </div>
            </div>

            {canHaveMedia && (
              <div className="px-5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Media</p>
                <div className="space-y-2.5 text-sm">
                  {hasVideo && videoFile ? (
                    <>
                      <Row label="Video" value={videoFile.name} />
                      <Row label="Size" value={`${(videoFile.size / 1024 / 1024).toFixed(1)} MB`} />
                      <Row label="Rights holder" value={participants.find((p) => p.participant_id === rightsHolderRef)?.label ?? rightsHolderRef.slice(0, 8)} />
                      <Row label="Rights basis" value={rightsBasis} />
                    </>
                  ) : (
                    <Row label="Video" value={<span className="text-muted-foreground">None — attach later</span>} />
                  )}
                </div>
              </div>
            )}

            <div className="px-5 py-3">
              <p className="text-xs text-muted-foreground">
                This will register the master, authorise its canonical state, and create the experiential projection
                {canHaveMedia && hasVideo && videoFile ? ", then upload and attach the video." : "."}
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={prevStep}>← Back</Button>
            <Button onClick={createWork}>
              Create {TYPE_LABELS[workType]}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground font-medium text-right">{value}</span>
    </div>
  );
}
