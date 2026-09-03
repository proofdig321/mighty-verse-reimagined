"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "../../_shared/authority-utils";

type Participant = { participant_id: string; label: string };

const CREDIT_ROLES = [
  "primary_artist", "featured_artist", "composer", "lyricist", "producer",
  "director", "editor", "cinematographer", "performer", "writer", "contributor",
] as const;

function useIntakeDraft<T>(field: string, initial: T) {
  const key = `mighty-verse-intake-${field}`;
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try { const s = window.localStorage.getItem(key); return s ? JSON.parse(s) as T : initial; } catch { return initial; }
  });
  useEffect(() => { window.localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}

function clearDraft() {
  if (typeof window === "undefined") return;
  Object.keys(window.localStorage).filter((k) => k.startsWith("mighty-verse-intake-")).forEach((k) => window.localStorage.removeItem(k));
}

export default function MediaIntakeClient({ participants }: { participants: Participant[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useIntakeDraft("title", "");
  const [creatorName, setCreatorName] = useIntakeDraft("creatorName", "");
  const [alternateTitle, setAlternateTitle] = useIntakeDraft("alternateTitle", "");
  const [description, setDescription] = useIntakeDraft("description", "");
  const [shortDescription, setShortDescription] = useIntakeDraft("shortDescription", "");
  const [originalLanguage, setOriginalLanguage] = useIntakeDraft("originalLanguage", "");
  const [workType, setWorkType] = useIntakeDraft("workType", "animation");
  const [versionLabel, setVersionLabel] = useIntakeDraft("versionLabel", "");
  const [edition, setEdition] = useIntakeDraft("edition", "");
  const [sourceType, setSourceType] = useIntakeDraft("sourceType", "upload");
  const [sourceUrl, setSourceUrl] = useIntakeDraft("sourceUrl", "");
  const [sourceProvider, setSourceProvider] = useIntakeDraft("sourceProvider", "");
  const [externalIdentifier, setExternalIdentifier] = useIntakeDraft("externalIdentifier", "");
  const [isrc, setIsrc] = useIntakeDraft("isrc", "");
  const [isrcStatus, setIsrcStatus] = useIntakeDraft("isrcStatus", "not-applicable");
  const [language, setLanguage] = useIntakeDraft("language", "");
  const [genre, setGenre] = useIntakeDraft("genre", "");
  const [subgenre, setSubgenre] = useIntakeDraft("subgenre", "");
  const [releaseDate, setReleaseDate] = useIntakeDraft("releaseDate", "");
  const [originalReleaseDate, setOriginalReleaseDate] = useIntakeDraft("originalReleaseDate", "");
  const [contentRating, setContentRating] = useIntakeDraft("contentRating", "");
  const [explicitContent, setExplicitContent] = useIntakeDraft("explicitContent", false);
  const [visibility, setVisibility] = useIntakeDraft("visibility", "draft");
  const [searchStatus, setSearchStatus] = useIntakeDraft("searchStatus", "pending");
  const [featured, setFeatured] = useIntakeDraft("featured", false);
  const [altText, setAltText] = useIntakeDraft("altText", "");
  const [provenanceNotes, setProvenanceNotes] = useIntakeDraft("provenanceNotes", "");
  const [creditRows, setCreditRows] = useIntakeDraft<{ participant_id: string; role: string }[]>("creditRows", []);
  const [creditParticipant, setCreditParticipant] = useState("");
  const [creditRole, setCreditRole] = useState<string>("primary_artist");

  const inputCls = "border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50";
  const selectCls = "border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm";

  function addCredit() {
    if (!creditParticipant || creditRows.some((r) => r.participant_id === creditParticipant && r.role === creditRole)) return;
    setCreditRows([...creditRows, { participant_id: creditParticipant, role: creditRole }]);
    setCreditParticipant("");
  }

  async function submit() {
    setBusy(true); setMessage(null);
    const result = await api("/api/authority/media-intake", {
      title,
      alternate_title: alternateTitle || null,
      description: description || null,
      short_description: shortDescription || null,
      original_language: originalLanguage || null,
      creator_name: creatorName || null,
      credits: creditRows,
      work_type: workType,
      source_type: sourceType,
      source_url: sourceType === "external-url" ? sourceUrl : null,
      source_provider: sourceProvider || null,
      external_identifier: externalIdentifier || null,
      isrc: isrc || null,
      isrc_status: workType === "song" || workType === "audio" ? isrcStatus : "not-applicable",
      version_label: versionLabel || null,
      version: versionLabel || null,
      edition: edition || null,
      provenance_notes: provenanceNotes || null,
      language: language || null,
      genre: genre || null,
      subgenre: subgenre || null,
      release_date: releaseDate || null,
      original_release_date: originalReleaseDate || null,
      content_rating: contentRating || null,
      explicit_content: explicitContent,
      visibility,
      search_status: searchStatus,
      featured,
      alt_text: altText || null,
    });
    setBusy(false);
    if (result.error) { setMessage(`Error: ${result.error}`); return; }
    clearDraft();
    router.push("/authority/media");
  }

  const steps = ["Media & identity", "Presentation", "Credits & provenance", "Review"];

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        {/* Step tabs */}
        <div className="grid grid-cols-4 gap-1" role="tablist">
          {steps.map((label, i) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={step === i + 1}
              onClick={() => setStep(i + 1)}
              className={`border-b-2 px-1 py-2 text-[10px] font-medium sm:text-xs transition-colors ${step === i + 1 ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        {/* Step 1 — Media & identity */}
        <div hidden={step !== 1} className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Media &amp; identity</p>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title *" disabled={busy} className={inputCls} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={creatorName} onChange={(e) => setCreatorName(e.target.value)} placeholder="Artist / creator" disabled={busy} className={inputCls} />
            <input value={alternateTitle} onChange={(e) => setAlternateTitle(e.target.value)} placeholder="Alternate title" disabled={busy} className={inputCls} />
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" disabled={busy} rows={2} className={`${inputCls} resize-none`} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} placeholder="Short description" disabled={busy} className={inputCls} />
            <input value={originalLanguage} onChange={(e) => setOriginalLanguage(e.target.value)} placeholder="Original language" disabled={busy} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={workType} onChange={(e) => setWorkType(e.target.value)} disabled={busy} className={selectCls}>
              <option value="animation">Animation</option>
              <option value="video">Video</option>
              <option value="song">Song</option>
              <option value="audio">Audio</option>
              <option value="other">Other</option>
            </select>
            <input value={versionLabel} onChange={(e) => setVersionLabel(e.target.value)} placeholder="Version / release" disabled={busy} className={inputCls} />
            <input value={edition} onChange={(e) => setEdition(e.target.value)} placeholder="Edition" disabled={busy} className={inputCls} />
          </div>
        </div>

        {/* Step 2 — Presentation */}
        <div hidden={step !== 2} className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Source &amp; presentation</p>
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} disabled={busy} className={selectCls}>
            <option value="upload">Local upload</option>
            <option value="external-url">Authorised external URL</option>
            <option value="livepeer-asset">Existing Livepeer asset</option>
          </select>
          {sourceType === "external-url" && (
            <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" disabled={busy} className={inputCls} />
          )}
          <div className="grid grid-cols-2 gap-2">
            <input value={sourceProvider} onChange={(e) => setSourceProvider(e.target.value)} placeholder="Source / platform" disabled={busy} className={inputCls} />
            <input value={externalIdentifier} onChange={(e) => setExternalIdentifier(e.target.value)} placeholder="External ID" disabled={busy} className={inputCls} />
          </div>
          {(workType === "song" || workType === "audio") && (
            <div className="grid grid-cols-2 gap-2">
              <select value={isrcStatus} onChange={(e) => setIsrcStatus(e.target.value)} disabled={busy} className={selectCls}>
                <option value="verified">ISRC verified</option>
                <option value="not-provided">Released, no ISRC</option>
                <option value="not-applicable">Unreleased / no ISRC</option>
              </select>
              <input value={isrc} onChange={(e) => setIsrc(e.target.value.toUpperCase())} placeholder="ISRC" disabled={busy || isrcStatus !== "verified"} className={inputCls} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="Language" disabled={busy} className={inputCls} />
            <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Genre" disabled={busy} className={inputCls} />
            <input value={subgenre} onChange={(e) => setSubgenre(e.target.value)} placeholder="Subgenre" disabled={busy} className={inputCls} />
            <input value={contentRating} onChange={(e) => setContentRating(e.target.value)} placeholder="Content rating" disabled={busy} className={inputCls} />
            <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} disabled={busy} className={inputCls} />
            <input type="date" value={originalReleaseDate} onChange={(e) => setOriginalReleaseDate(e.target.value)} disabled={busy} className={inputCls} />
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)} disabled={busy} className={selectCls}>
              <option value="draft">Draft</option>
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
            <select value={searchStatus} onChange={(e) => setSearchStatus(e.target.value)} disabled={busy} className={selectCls}>
              <option value="pending">Search: pending</option>
              <option value="indexed">Search: indexed</option>
              <option value="excluded">Search: excluded</option>
            </select>
          </div>
          <input value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Artwork alt text" disabled={busy} className={inputCls} />
          <div className="flex gap-4 text-xs text-muted-foreground">
            <label className="flex items-center gap-2"><input type="checkbox" checked={explicitContent} onChange={(e) => setExplicitContent(e.target.checked)} disabled={busy} /> Explicit content</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} disabled={busy} /> Feature in discovery</label>
          </div>
        </div>

        {/* Step 3 — Credits & provenance */}
        <div hidden={step !== 3} className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Credits</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem_auto]">
            <select value={creditParticipant} onChange={(e) => setCreditParticipant(e.target.value)} disabled={busy} className={selectCls}>
              <option value="">Select participant</option>
              {participants.map((p) => <option key={p.participant_id} value={p.participant_id}>{p.label}</option>)}
            </select>
            <select value={creditRole} onChange={(e) => setCreditRole(e.target.value)} disabled={busy} className={selectCls}>
              {CREDIT_ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
            </select>
            <Button type="button" size="sm" variant="outline" disabled={busy || !creditParticipant} onClick={addCredit}>Add</Button>
          </div>
          {creditRows.length > 0 && (
            <ul className="space-y-1">
              {creditRows.map((row, i) => (
                <li key={`${row.participant_id}-${row.role}`} className="flex items-center justify-between gap-2 rounded border border-border px-3 py-2 text-xs">
                  <span>{participants.find((p) => p.participant_id === row.participant_id)?.label ?? row.participant_id} · {row.role.replace(/_/g, " ")}</span>
                  <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => setCreditRows(creditRows.filter((_, j) => j !== i))}>Remove</button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground pt-2">Provenance</p>
          <textarea value={provenanceNotes} onChange={(e) => setProvenanceNotes(e.target.value)} placeholder="Provenance / production notes" disabled={busy} rows={3} className={`${inputCls} resize-none`} />
        </div>

        {/* Step 4 — Review */}
        <div hidden={step !== 4} className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Review before submission</p>
          <p className="text-sm text-foreground">
            <span className="font-medium">{title || "Untitled media"}</span>
            {creatorName ? ` by ${creatorName}` : ""}
          </p>
          <dl className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div><dt className="font-medium text-foreground">Work type</dt><dd>{workType}{versionLabel ? ` · ${versionLabel}` : ""}</dd></div>
            <div><dt className="font-medium text-foreground">Publishing</dt><dd>{visibility} · {searchStatus}{featured ? " · featured" : ""}</dd></div>
            <div><dt className="font-medium text-foreground">Credits</dt><dd>{creditRows.length ? `${creditRows.length} credit${creditRows.length !== 1 ? "s" : ""}` : "None"}</dd></div>
            <div><dt className="font-medium text-foreground">Source</dt><dd>{sourceType}{sourceProvider ? ` · ${sourceProvider}` : ""}</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">Submission creates the intake record. Video upload is a separate step from the Media Gallery.</p>
        </div>

        {message && <p role="alert" className="text-sm text-destructive">{message}</p>}

        <div className="flex justify-between gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy || step === 1} onClick={() => setStep((s) => s - 1)}>Back</Button>
          {step < 4
            ? <Button type="button" size="sm" disabled={busy || (step === 1 && !title.trim())} onClick={() => setStep((s) => s + 1)}>Continue</Button>
            : <Button size="sm" disabled={busy || !title.trim() || (sourceType === "external-url" && !sourceUrl.trim())} onClick={submit}>Create intake record</Button>
          }
        </div>
      </CardContent>
    </Card>
  );
}
