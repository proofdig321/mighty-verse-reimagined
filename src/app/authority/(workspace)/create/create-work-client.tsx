"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "../_shared/authority-utils";

type Universe = { master_id: string; title: string | null };
type Mural = { master_id: string; parent_master_id: string | null; title: string | null };

type Props = {
  universes: Universe[];
  murals: Mural[];
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

type Step = "type" | "placement" | "identity" | "authorise" | "done";

export default function CreateWorkClient({ universes, murals }: Props) {
  const router = useRouter();

  const [step, setStep] = useState<Step>("type");
  const [workType, setWorkType] = useState<WorkType>("scene");
  const [parentMasterId, setParentMasterId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectionType, setProjectionType] = useState("experiential");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [createdMasterId, setCreatedMasterId] = useState<string | null>(null);

  const needsParent = workType === "mural" || workType === "scene" || workType === "creative-moment";
  const parentOptions = workType === "mural" || workType === "creative-moment"
    ? universes
    : workType === "scene"
    ? murals
    : [];

  async function createWork() {
    setBusy(true);
    setMsg(null);

    try {
      // Step 1: Register master (with title/description if provided)
      const masterRes = await api("/api/authority/masters", {
        canonical_type: workType,
        parent_master_id: parentMasterId || null,
        title: title.trim() || null,
        description: description.trim() || null,
      });
      if (masterRes.error) throw new Error(masterRes.error);
      const masterId: string = masterRes.master_id;
      setCreatedMasterId(masterId);

      // Step 2: Authorise canonical state
      const stateRes = await api("/api/authority/states", { master_id: masterId });
      if (stateRes.error) throw new Error(stateRes.error);

      // Step 3: Create experiential projection
      const projRes = await api("/api/authority/projections", {
        canonical_state_id: stateRes.canonical_state_id,
        master_id: masterId,
        projection_type: projectionType,
      });
      if (projRes.error) throw new Error(projRes.error);

      setStep("done");
    } catch (err) {
      setMsg(`Error: ${err instanceof Error ? err.message : "Creation failed"}`);
    } finally {
      setBusy(false);
    }
  }

  if (step === "done" && createdMasterId) {
    return (
      <div className="space-y-8 max-w-xl">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Create Work</p>
          <h1 className="text-3xl font-semibold tracking-tight">Work created</h1>
        </div>
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-5 py-5 space-y-2">
          <p className="text-sm font-medium text-emerald-400">
            {TYPE_LABELS[workType]} created and authorised
          </p>
          <p className="text-xs text-muted-foreground">
            {title.trim() ? `"${title.trim()}"` : "Untitled"} — canonical state authorised, experiential projection created.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => router.push(`/authority/${createdMasterId}`)}>
            Open work →
          </Button>
          <Button variant="outline" onClick={() => {
            setStep("type");
            setTitle("");
            setDescription("");
            setParentMasterId("");
            setCreatedMasterId(null);
            setMsg(null);
          }}>
            Create another
          </Button>
        </div>
      </div>
    );
  }

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

      {/* Progress */}
      <div className="flex items-center gap-2">
        {(["type", "placement", "identity", "authorise"] as Step[]).map((s, i) => {
          const stepIndex = ["type", "placement", "identity", "authorise"].indexOf(step);
          const thisIndex = i;
          const done = thisIndex < stepIndex;
          const current = thisIndex === stepIndex;
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-6 bg-border" />}
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${done ? "bg-emerald-500 text-emerald-950" : current ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
                {done ? "✓" : i + 1}
              </div>
              <span className={`text-xs hidden sm:inline ${current ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {s === "type" ? "Type" : s === "placement" ? "Placement" : s === "identity" ? "Identity" : "Create"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step 1: Work type */}
      {step === "type" && (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-foreground mb-3">What are you creating?</p>
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
          </div>
          <Button onClick={() => setStep(needsParent ? "placement" : "identity")}>
            Continue →
          </Button>
        </div>
      )}

      {/* Step 2: Placement in hierarchy */}
      {step === "placement" && (
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              {workType === "mural" || workType === "creative-moment" ? "Which Universe?" : "Which Mural?"}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              {workType === "mural" ? "This Mural will belong to the selected Universe." :
               workType === "scene" ? "This Scene will belong to the selected Mural." :
               "This Creative Moment will belong to the selected Universe."}
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
            <Button variant="outline" onClick={() => setStep("type")}>← Back</Button>
            <Button disabled={!parentMasterId} onClick={() => setStep("identity")}>Continue →</Button>
          </div>
        </div>
      )}

      {/* Step 3: Identity / presentation */}
      {step === "identity" && (
        <div className="space-y-5">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Title</p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`${TYPE_LABELS[workType]} title`}
                className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Description <span className="text-muted-foreground font-normal">(optional)</span></p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description"
                rows={3}
                className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm resize-none"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Experience type</p>
              <select
                value={projectionType}
                onChange={(e) => setProjectionType(e.target.value)}
                className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="experiential">Experiential</option>
                <option value="distributional">Distributional</option>
                <option value="archival">Archival</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(needsParent ? "placement" : "type")}>← Back</Button>
            <Button onClick={() => setStep("authorise")}>Continue →</Button>
          </div>
        </div>
      )}

      {/* Step 4: Review + create */}
      {step === "authorise" && (
        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-card/50 px-5 py-5 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Review</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="text-foreground font-medium">{TYPE_LABELS[workType]}</span>
              </div>
              {parentMasterId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parent</span>
                  <span className="text-foreground font-medium">
                    {parentOptions.find((p) => p.master_id === parentMasterId)?.title ?? parentMasterId.slice(0, 8)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Title</span>
                <span className="text-foreground font-medium">{title.trim() || <span className="italic text-muted-foreground">Untitled</span>}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Experience</span>
                <span className="text-foreground font-medium capitalize">{projectionType}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              This will register the master, authorise its canonical state, and create the experiential projection in one step.
            </p>
          </div>
          {msg && <p className="text-sm text-destructive">{msg}</p>}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("identity")} disabled={busy}>← Back</Button>
            <Button onClick={createWork} disabled={busy}>
              {busy ? "Creating…" : `Create ${TYPE_LABELS[workType]}`}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
