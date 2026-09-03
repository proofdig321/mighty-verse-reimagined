export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/media/timing";

async function getData(assetId: string) {
  const svc = getServiceClient();

  const { data: asset } = await svc
    .from("media_asset")
    .select("asset_id, asset_type, storage_ref, format, duration_ms, created_at, rights_holder_ref, rights_basis, width, height, codec, container, bitrate_kbps, audio_presence, audio_channels, sample_rate_hz, captions_available")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (!asset) return null;

  const [{ data: bindings }, { data: intake }] = await Promise.all([
    svc
      .from("projection_media_binding")
      .select("binding_id, projection_id, binding_type, access_level, start_ms, end_ms, realization_id")
      .eq("asset_id", assetId),
    svc.from("media_intake").select("*").eq("asset_id", assetId).maybeSingle(),
  ]);

  const projIds = (bindings ?? []).map((b) => b.projection_id);
  const [{ data: projections }, { data: intakeCredits }, { data: rightsParticipant }] = await Promise.all([
    projIds.length
      ? svc.from("projection").select("projection_id, master_id, projection_type").in("projection_id", projIds)
      : Promise.resolve({ data: [] }),
    intake
      ? svc.from("media_intake_credit").select("participant_id, role, display_order").eq("intake_id", intake.intake_id).order("display_order")
      : Promise.resolve({ data: [] }),
    asset.rights_holder_ref
      ? svc.from("participant").select("participant_id, identity_link(identity_ref, active)").eq("participant_id", asset.rights_holder_ref).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const masterIds = [...new Set((projections ?? []).map((p) => p.master_id))];
  const { data: presentations } = masterIds.length
    ? await svc.from("work_presentation").select("master_id, title").in("master_id", masterIds)
    : { data: [] };

  const rightsLabel = rightsParticipant
    ? (Array.isArray((rightsParticipant as { identity_link: { active: boolean; identity_ref: string }[] }).identity_link)
        ? (rightsParticipant as { identity_link: { active: boolean; identity_ref: string }[] }).identity_link.find((l) => l.active)?.identity_ref
        : null) ?? asset.rights_holder_ref?.slice(0, 8)
    : null;

  return {
    asset,
    intake: intake ? { ...intake, credits: intakeCredits ?? [] } : null,
    bindings: (bindings ?? []).map((b) => {
      const proj = (projections ?? []).find((p) => p.projection_id === b.projection_id);
      const pres = proj ? (presentations ?? []).find((p) => p.master_id === proj.master_id) : null;
      return { ...b, masterTitle: pres?.title ?? null, masterId: proj?.master_id ?? null, projectionType: proj?.projection_type ?? null };
    }),
    rightsLabel,
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

  const { asset, intake, bindings, rightsLabel } = data;
  const isPlaceholder = asset.storage_ref.startsWith("seed:placeholder:");
  const title = intake?.title ?? (isPlaceholder ? "Placeholder asset" : asset.storage_ref.slice(0, 16) + "…");

  return (
    <div className="space-y-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <a href="/authority" className="hover:text-foreground transition-colors">Authority</a>
        <ChevronRight size={12} />
        <a href="/authority/media" className="hover:text-foreground transition-colors">Media</a>
        <ChevronRight size={12} />
        <span className="text-foreground">{title}</span>
      </div>

      {/* Header */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Media Asset</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="outline">{asset.asset_type}</Badge>
          {asset.format && <Badge variant="outline">{asset.format}</Badge>}
          {asset.duration_ms && <Badge variant="outline">{formatDuration(asset.duration_ms / 1000)}</Badge>}
          {isPlaceholder && <Badge variant="destructive">Placeholder</Badge>}
        </div>
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

        {/* Storage */}
        <div className="rounded-lg border border-border bg-card/50 px-4 py-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Storage</p>
          <p className="text-xs font-mono text-muted-foreground break-all">{asset.storage_ref}</p>
          <p className="text-xs text-muted-foreground">{new Date(asset.created_at).toLocaleDateString()}</p>
        </div>
      </div>

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
                  {intake.credits.map((c: { participant_id: string; role: string }) => (
                    <li key={`${c.participant_id}-${c.role}`} className="text-xs text-muted-foreground">
                      {c.participant_id.slice(0, 8)}… · {c.role.replace(/_/g, " ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <a href={`/authority/media/intake`} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Edit intake record →
            </a>
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
                        <a href={`/authority/${b.masterId}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          Open <ChevronRight size={13} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
