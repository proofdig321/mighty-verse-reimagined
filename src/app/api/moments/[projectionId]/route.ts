import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/authority/validate";
import type { ProjectionMedia } from "@/components/player/projection-media-player";

export type MomentData = {
  projection: {
    projection_id: string;
    projection_type: string;
    collectible_designated: boolean;
    integrity_hash: string;
    created_at: string;
  };
  canonical_state: {
    canonical_state_id: string;
    version: number;
    authorisation_state: string;
  };
  master: {
    master_id: string;
    canonical_type: string;
  };
  provenance: {
    relationship_type: string;
    integrity_hash: string;
  };
  attribution: {
    roles: { role_type: string }[];
  };
  media: ProjectionMedia | null;
  presentation: { title: string; description: string | null } | null;
  worldTitle: string | null;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectionId: string }> }
) {
  const { projectionId } = await params;
  const svc = getServiceClient();

  const { data: proj } = await svc
    .from("projection")
    .select("projection_id, projection_type, collectible_designated, integrity_hash, created_at, canonical_state_id, master_id")
    .eq("projection_id", projectionId)
    .single();

  if (!proj) return NextResponse.json({ error: "Moment not found" }, { status: 404 });

  const { data: cs } = await svc
    .from("canonical_state")
    .select("canonical_state_id, version, authorisation_state")
    .eq("canonical_state_id", proj.canonical_state_id)
    .single();

  const { data: master } = await svc
    .from("master")
    .select("master_id, canonical_type")
    .eq("master_id", proj.master_id)
    .single();

  // Public provenance for this projection only
  const { data: prov } = await svc
    .from("provenance_record")
    .select("relationship_type, integrity_hash")
    .eq("subject_id", projectionId)
    .eq("subject_type", "projection")
    .eq("public", true)
    .single();

  // Public attribution via master's attribution_record
  const { data: masterFull } = await svc
    .from("master")
    .select("attribution_ref")
    .eq("master_id", proj.master_id)
    .single();

  const { data: attrEntries } = masterFull?.attribution_ref
    ? await svc
        .from("attribution_entry")
        .select("role_type")
        .eq("attribution_id", masterFull.attribution_ref)
        .eq("public", true)
    : { data: [] };

  // Media binding
  const { data: binding } = await svc
    .from("projection_media_binding")
    .select("binding_type, access_level, asset_id")
    .eq("projection_id", projectionId)
    .eq("binding_type", "primary")
    .eq("access_level", "public")
    .single();

  const [{ data: projPresentation }, { data: worldPresentation }] = await Promise.all([
    svc.from("projection_presentation").select("title, description").eq("projection_id", projectionId).maybeSingle(),
    svc.from("work_presentation").select("title").eq("master_id", proj.master_id).maybeSingle(),
  ]);

  let media: ProjectionMedia | null = null;
  if (binding) {
    const { data: asset } = await svc
      .from("media_asset")
      .select("storage_ref")
      .eq("asset_id", binding.asset_id)
      .single();
    const { data: variant } = await svc
      .from("delivery_variant")
      .select("delivery_format, endpoint_ref")
      .eq("asset_id", binding.asset_id)
      .single();
    const isPlaceholder = asset?.storage_ref?.startsWith("seed:placeholder:") ?? true;
    media = {
      binding_type: binding.binding_type,
      access_level: binding.access_level,
      delivery_format: variant?.delivery_format ?? "hls",
      playback_id: isPlaceholder ? null : (asset?.storage_ref ?? null),
      is_placeholder: isPlaceholder,
    };
  }

  const moment: MomentData = {
    projection: {
      projection_id: proj.projection_id,
      projection_type: proj.projection_type,
      collectible_designated: proj.collectible_designated,
      integrity_hash: proj.integrity_hash,
      created_at: proj.created_at,
    },
    canonical_state: {
      canonical_state_id: cs?.canonical_state_id ?? proj.canonical_state_id,
      version: cs?.version ?? 0,
      authorisation_state: cs?.authorisation_state ?? "unknown",
    },
    master: {
      master_id: master?.master_id ?? proj.master_id,
      canonical_type: master?.canonical_type ?? "other",
    },
    provenance: {
      relationship_type: prov?.relationship_type ?? "",
      integrity_hash: prov?.integrity_hash ?? "",
    },
    attribution: {
      roles: (attrEntries ?? []).map((e) => ({ role_type: e.role_type })),
    },
    media,
    presentation: projPresentation ?? null,
    worldTitle: worldPresentation?.title ?? null,
  };

  return NextResponse.json(moment);
}
