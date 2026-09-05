export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/media/timing";
import { deriveMediaReadiness } from "@/lib/media/readiness";
import { formatIsrcDisplay, isIsrcEligible, type IsrcStatus } from "@/lib/media/isrc";
import { IsrcWorkflowPanel } from "./isrc-workflow-panel";
import { MetadataStatusPanel } from "./metadata-status-panel";
import { buildCanonicalMetadata } from "@/lib/media/metadata-build";
import { checkMetadataConsistency } from "@/lib/media/metadata-embed";

async function getData(assetId: string) {
  const svc = getServiceClient();

  const { data: asset } = await svc
    .from("media_asset")
    .select("asset_id, asset_type, storage_ref, format, duration_ms, created_at, rights_holder_ref, rights_basis, width, height, codec, container, bitrate_kbps, audio_presence, audio_channels, sample_rate_hz, captions_available, provider, provider_asset_id, intake_id, realization_id")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (!asset) return null;

  const [{ data: bindings }, { data: intake }] = await Promise.all([
    svc
      .from("projection_media_binding")
      .select("binding_id, projection_id, binding_type, access_level, start_ms, end_ms, realization_id")
      .eq("asset_id", assetId),
    asset.intake_id
      ? svc.from("media_intake").select("*").eq("intake_id", asset.intake_id).maybeSingle()
      : svc.from("media_intake").select("*").eq("asset_id", assetId).maybeSingle(),
  ]);

  const projIds = (bindings ?? []).map((b) => b.projection_id);
  const rawCredits = intake
    ? (await svc.from("media_intake_credit").select("participant_id, role, display_order").eq("intake_id", intake.intake_id).order("display_order")).data ?? []
    : [];
  const creditParticipantIds = [...new Set(rawCredits.map((c) => c.participant_id))];

  const [{ data: projections }, { data: rightsParticipant }, { data: creditParticipants }, { data: realization }] = await Promise.all([
    projIds.length
      ? svc.from("projection").select("projection_id, master_id, projection_type").in("projection_id", projIds)
      : Promise.resolve({ data: [] }),
    asset.rights_holder_ref
      ? svc.from("participant").select("participant_id, identity_link(identity_ref, active)").eq("participant_id", asset.rights_holder_ref).maybeSingle()
      : Promise.resolve({ data: null }),
    creditParticipantIds.length
      ? svc.from("participant").select("participant_id, identity_link(identity_ref, active)").in("participant_id", creditParticipantIds)
      : Promise.resolve({ data: [] }),
    asset.realization_id
      ? svc.from("media_realization").select("realization_id, master_id, realization_type, rights_holder_ref, rights_basis, production_notes, isrc, isrc_status, version_label").eq("realization_id", asset.realization_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Split sheet for this realization
  const { data: splitSheet } = realization
    ? await svc
        .from("media_split_sheet")
        .select("split_sheet_id, applicable, not_applicable_reason, status, effective_date, agreement_reference")
        .eq("realization_id", realization.realization_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  // Active ISRC registrant for the assignment workflow
  const { data: registrant } = await svc
    .from("isrc_registrant")
    .select("registrant_id, registrant_name, prefix_code")
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  const masterIds = [...new Set((projections ?? []).map((p) => p.master_id))];
  const { data: presentations } = masterIds.length
    ? await svc.from("work_presentation").select("master_id, title").in("master_id", masterIds)
    : { data: [] };

  function resolveLabel(participantId: string, rows: { participant_id: string; identity_link: unknown }[] | null): string {
    const p = (rows ?? []).find((r) => r.participant_id === participantId);
    if (!p) return participantId.slice(0, 8) + "…";
    return Array.isArray(p.identity_link)
      ? (p.identity_link as { active: boolean; identity_ref: string }[]).find((l) => l.active)?.identity_ref ?? participantId.slice(0, 8) + "…"
      : participantId.slice(0, 8) + "…";
  }

  const rightsLabel = rightsParticipant
    ? resolveLabel(asset.rights_holder_ref!, [rightsParticipant as { participant_id: string; identity_link: unknown }])
    : null;

  const intakeCredits = rawCredits.map((c) => ({
    participant_id: c.participant_id,
    role: c.role,
    label: resolveLabel(c.participant_id, creditParticipants as { participant_id: string; identity_link: unknown }[] | null),
  }));

  const readiness = deriveMediaReadiness({
    hasAsset: !asset.storage_ref.startsWith("seed:placeholder:") && !asset.storage_ref.startsWith("http"),
    isPlaceholder: asset.storage_ref.startsWith("seed:placeholder:"),
    hasRights: !!asset.rights_holder_ref,
    hasCredits: rawCredits.length > 0,
    isrcStatus: intake?.isrc_status ?? realization?.isrc_status ?? null,
    workType: intake?.work_type ?? null,
  });

  return {
    asset,
    intake: intake ? { ...intake, credits: intakeCredits } : null,
    bindings: (bindings ?? []).map((b) => {
      const proj = (projections ?? []).find((p) => p.projection_id === b.projection_id);
      const pres = proj ? (presentations ?? []).find((p) => p.master_id === proj.master_id) : null;
      return { ...b, masterTitle: pres?.title ?? null, masterId: proj?.master_id ?? null, projectionType: proj?.projection_type ?? null };
    }),
    rightsLabel,
    realization: realization ?? null,
    splitSheet,
    readiness,
    registrant: registrant ?? null,
  };
}

export default async function MediaAssetPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  if (!await getParticipantId(supabase)) redirect("/auth/sign-in");

  const data = await getData(assetId);
  if (!data) notFound();

  // Load metadata status (non-fatal if unavailable)
  const [canonicalMeta, metadataReport] = await Promise.all([
    buildCanonicalMetadata(assetId).catch(() => null),
    buildCanonicalMetadata(assetId)
      .then(m => m ? checkMetadataConsistency(assetId, m) : null)
      .catch(() => null),
  ]);

  const { asset, intake, bindings, rightsLabel, realization, splitSheet, readiness, registrant } = data;
  const isPlaceholder = asset.storage_ref.startsWith("seed:placeholder:");
  const isThumbnail = asset.storage_ref.startsWith("thumbnail:") || (asset.storage_ref.startsWith("http") && asset.asset_type === "thumbnail");
  const title = intake?.title ?? (isPlaceholder ? "Placeholder asset" : asset.storage_ref.slice(0, 16) + "…");

  // Livepeer thumbnail for video assets — storage_ref is the playback ID
  const thumbnailUrl = !isThumbnail && !isPlaceholder && asset.asset_type !== "thumbnail" && asset.provider === "livepeer"
    ? `https://vod-cdn.lp-playback.studio/raw/jxf4iblf6wlsyor6526t4tcmtmqa/catalyst-vod-com/hls/${asset.storage_ref}/thumbnails/keyframes_0.png`
    : null;

  return (
    <div className="space-y-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/authority" className="hover:text-foreground transition-colors">Authority</Link>
        <ChevronRight size={12} />
        <Link href="/authority/media" className="hover:text-foreground transition-colors">Media Library</Link>
        <ChevronRight size={12} />
        <span className="text-foreground">{title}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-6">
        {thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={title}
            className="hidden sm:block w-32 aspect-video rounded-lg object-cover border border-border shrink-0"
          />
        )}
        <div className="space-y-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Media Asset</p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline">{asset.asset_type}</Badge>
            {intake?.work_type && <Badge variant="outline">{intake.work_type}</Badge>}
            {asset.format && <Badge variant="outline">{asset.format}</Badge>}
            {asset.duration_ms && <Badge variant="outline">{formatDuration(asset.duration_ms / 1000)}</Badge>}
            {isPlaceholder && <Badge variant="destructive">Placeholder</Badge>}
          </div>
        </div>
      </div>

      {/* Readiness checklist */}
      <div className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Readiness</p>
          <span className={`text-xs font-semibold ${readiness.overall === "ready" ? "text-emerald-400" : readiness.overall === "playable" ? "text-violet-400" : "text-amber-400"}`}>
            {readiness.overall === "ready" ? "Ready" : readiness.overall === "playable" ? "Playable" : readiness.overall === "processing" ? "Processing" : "Intake"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {readiness.steps.map((step) => (
            <div key={step.label} className="flex items-center gap-1.5 text-xs">
              <span className={step.state === "complete" ? "text-emerald-400" : step.state === "not-applicable" ? "text-muted-foreground/30" : "text-muted-foreground/50"}>
                {step.state === "complete" ? "✓" : step.state === "not-applicable" ? "—" : "○"}
              </span>
              <span className={step.state === "complete" ? "text-foreground" : step.state === "not-applicable" ? "text-muted-foreground/30" : "text-muted-foreground/60"}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
        {readiness.blockers.length > 0 && (
          <p className="text-xs text-muted-foreground/60">
            Not ready: {readiness.blockers.join(" · ")}
          </p>
        )}
      </div>

      {/* Overview grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Rights */}
        <div className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Rights</p>
          {asset.rights_holder_ref ? (
            <>
              <p className="text-sm text-foreground">{rightsLabel ?? asset.rights_holder_ref.slice(0, 8) + "…"}</p>
              <p className="text-xs text-muted-foreground">{asset.rights_basis ?? "Basis not recorded"}</p>
            </>
          ) : (
            <p className="text-sm text-amber-400">Rights holder not recorded</p>
          )}
        </div>

        {/* Technical */}
        <div className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Technical</p>
          <dl className="space-y-0.5 text-xs text-muted-foreground">
            {asset.width && asset.height && <div><dt className="inline text-foreground/60">Resolution </dt><dd className="inline">{asset.width}×{asset.height}</dd></div>}
            {asset.codec && <div><dt className="inline text-foreground/60">Codec </dt><dd className="inline">{asset.codec}</dd></div>}
            {asset.container && <div><dt className="inline text-foreground/60">Container </dt><dd className="inline">{asset.container}</dd></div>}
            {asset.bitrate_kbps && <div><dt className="inline text-foreground/60">Bitrate </dt><dd className="inline">{asset.bitrate_kbps} kbps</dd></div>}
            {asset.audio_presence != null && <div><dt className="inline text-foreground/60">Audio </dt><dd className="inline">{asset.audio_presence ? "Yes" : "No"}</dd></div>}
            {!asset.width && !asset.codec && <p className="italic">Technical metadata not yet recorded</p>}
          </dl>
        </div>

        {/* Storage / Provider */}
        <div className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Storage</p>
          <p className="text-xs font-mono text-muted-foreground break-all">{asset.storage_ref}</p>
          {asset.provider && (
            <p className="text-xs text-muted-foreground">
              Provider: <span className="text-foreground/70">{asset.provider}</span>
              {asset.provider_asset_id && (
                <span className="ml-1 font-mono text-muted-foreground/50">{asset.provider_asset_id.slice(0, 12)}…</span>
              )}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{new Date(asset.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Recording identity */}
      {realization && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Recording Identity</p>
          <div className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-4">
            <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 md:grid-cols-3">
              <div><dt className="text-muted-foreground">Type</dt><dd className="text-foreground">{realization.realization_type}</dd></div>
              {realization.version_label && <div><dt className="text-muted-foreground">Version</dt><dd className="text-foreground">{realization.version_label}</dd></div>}
              {realization.rights_basis && <div><dt className="text-muted-foreground">Rights basis</dt><dd className="text-foreground">{realization.rights_basis}</dd></div>}
            </dl>
            {realization.production_notes && (
              <p className="text-xs text-muted-foreground">{realization.production_notes}</p>
            )}

            {/* ISRC workflow */}
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">ISRC</p>
              {isIsrcEligible(realization.realization_type) ? (
                <IsrcWorkflowPanel
                  realizationId={realization.realization_id}
                  masterId={realization.master_id}
                  realizationType={realization.realization_type}
                  currentIsrc={realization.isrc ?? null}
                  currentIsrcStatus={(realization.isrc_status ?? "not-applicable") as IsrcStatus}
                  hasRights={!!realization.rights_holder_ref}
                  recordingTitle={title}
                  versionLabel={realization.version_label ?? null}
                  registrant={registrant}
                />
              ) : (
                <p className="text-xs text-muted-foreground/50 italic">
                  Not applicable — {realization.realization_type} recordings do not require an ISRC.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Split sheet */}
      {realization && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Split Sheet</p>
          <div className="rounded-lg border border-border bg-card/50 px-4 py-4">
            {splitSheet ? (
              <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Applicable</dt><dd className="text-foreground">{splitSheet.applicable ? "Yes" : `No — ${splitSheet.not_applicable_reason ?? "not applicable"}`}</dd></div>
                <div><dt className="text-muted-foreground">Status</dt><dd className="text-foreground">{splitSheet.status}</dd></div>
                {splitSheet.effective_date && <div><dt className="text-muted-foreground">Effective</dt><dd className="text-foreground">{splitSheet.effective_date}</dd></div>}
                {splitSheet.agreement_reference && <div><dt className="text-muted-foreground">Agreement ref</dt><dd className="text-foreground font-mono text-muted-foreground/70">{splitSheet.agreement_reference}</dd></div>}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground/60 italic">No split sheet recorded for this realization.</p>
            )}
          </div>
        </div>
      )}

      {/* Intake record */}
      {intake && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Intake Record</p>
          <div className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-3">
            <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 md:grid-cols-3">
              {intake.creator_name && <div><dt className="text-muted-foreground">Creator</dt><dd className="text-foreground">{intake.creator_name}</dd></div>}
              <div><dt className="text-muted-foreground">Work type</dt><dd className="text-foreground">{intake.work_type}</dd></div>
              <div><dt className="text-muted-foreground">Visibility</dt><dd className="text-foreground">{intake.visibility}</dd></div>
              {intake.genre && <div><dt className="text-muted-foreground">Genre</dt><dd className="text-foreground">{intake.genre}{intake.subgenre ? ` / ${intake.subgenre}` : ""}</dd></div>}
              {intake.language && <div><dt className="text-muted-foreground">Language</dt><dd className="text-foreground">{intake.language}</dd></div>}
              {intake.isrc && <div><dt className="text-muted-foreground">ISRC</dt><dd className="text-foreground font-mono">{intake.isrc}</dd></div>}
              {intake.release_date && <div><dt className="text-muted-foreground">Release date</dt><dd className="text-foreground">{intake.release_date}</dd></div>}
              {intake.source_provider && <div><dt className="text-muted-foreground">Source</dt><dd className="text-foreground">{intake.source_provider}</dd></div>}
              {intake.source_type === "external-url" && intake.source_url && (
                <div className="sm:col-span-2"><dt className="text-muted-foreground">Source URL</dt><dd className="text-foreground font-mono text-muted-foreground/70 break-all">{intake.source_url} <span className="text-muted-foreground/40 font-sans">(reference only — not ingested)</span></dd></div>
              )}
            </dl>
            {intake.description && <p className="text-sm text-muted-foreground">{intake.description}</p>}
            {intake.provenance_notes && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Provenance notes</p>
                <p className="text-xs text-muted-foreground">{intake.provenance_notes}</p>
              </div>
            )}
            {intake.credits.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Credits</p>
                <ul className="space-y-0.5">
                  {intake.credits.map((c: { participant_id: string; role: string; label: string }) => (
                    <li key={`${c.participant_id}-${c.role}`} className="text-xs text-muted-foreground">
                      {c.label} · {c.role.replace(/_/g, " ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Canonical bindings */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Canonical Bindings
          <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/60">{bindings.length} projection{bindings.length !== 1 ? "s" : ""}</span>
        </p>
        {bindings.length === 0 ? (
          <p className="text-sm text-muted-foreground">This asset is not bound to any projection.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/20">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Work</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Type</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Timing</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Access</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bindings.map((b) => (
                  <tr key={b.binding_id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {b.masterTitle ?? <span className="italic text-muted-foreground">Untitled</span>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground text-xs">{b.projectionType ?? "—"}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs font-mono text-muted-foreground">
                      {b.start_ms != null && b.end_ms != null
                        ? `${formatDuration(b.start_ms / 1000)} → ${formatDuration(b.end_ms / 1000)}`
                        : <span className="font-sans italic">Full asset</span>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">{b.access_level}</td>
                    <td className="px-4 py-3 text-right">
                      {b.masterId && (
                        <Link href={`/authority/${b.masterId}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          Open <ChevronRight size={13} />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Media Metadata */}
      <MetadataStatusPanel
        assetId={assetId}
        initialMeta={canonicalMeta}
        initialReport={metadataReport}
      />

      {/* Distribution */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Distribution</p>
        <div className="rounded-lg border border-border bg-card/30 px-4 py-4">
          <p className="text-sm text-muted-foreground/60 italic">Not yet distributed. Distribution integrations are a future phase.</p>
        </div>
      </div>
    </div>
  );
}
