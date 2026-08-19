import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/authority/validate";

export type WorldData = {
  master: {
    master_id: string;
    canonical_type: string;
  };
  canonical_state: {
    canonical_state_id: string;
    version: number;
    authorisation_state: string;
    integrity_hash: string;
    created_at: string;
  };
  projection: {
    projection_id: string;
    projection_type: string;
    collectible_designated: boolean;
    integrity_hash: string;
  };
  provenance: {
    canonical_state: { relationship_type: string; integrity_hash: string };
    projection: { relationship_type: string; integrity_hash: string };
  };
  attribution: {
    roles: { role_type: string }[];
  };
  media: {
    binding_type: string;
    access_level: string;
    delivery_format: string;
    // null when placeholder — never expose storage_ref or raw asset internals
    playback_id: string | null;
    is_placeholder: boolean;
  } | null;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ masterId: string }> }
) {
  const { masterId } = await params;
  const svc = getServiceClient();

  // Master
  const { data: master } = await svc
    .from("master")
    .select("master_id, canonical_type, current_state_id, attribution_ref")
    .eq("master_id", masterId)
    .single();

  if (!master) return NextResponse.json({ error: "World not found" }, { status: 404 });

  // Canonical state
  const { data: cs } = await svc
    .from("canonical_state")
    .select("canonical_state_id, version, authorisation_state, integrity_hash, created_at")
    .eq("canonical_state_id", master.current_state_id)
    .eq("authorisation_state", "authorised")
    .single();

  if (!cs) return NextResponse.json({ error: "No authorised canonical state" }, { status: 404 });

  // Projection (experiential, public binding)
  const { data: proj } = await svc
    .from("projection")
    .select("projection_id, projection_type, collectible_designated, integrity_hash")
    .eq("canonical_state_id", cs.canonical_state_id)
    .eq("projection_type", "experiential")
    .single();

  if (!proj) return NextResponse.json({ error: "No experiential projection" }, { status: 404 });

  // Public provenance records
  const { data: provRecords } = await svc
    .from("provenance_record")
    .select("subject_id, subject_type, relationship_type, integrity_hash, public")
    .in("subject_id", [cs.canonical_state_id, proj.projection_id])
    .eq("public", true);

  const provCS = provRecords?.find((p) => p.subject_type === "canonical-state");
  const provProj = provRecords?.find((p) => p.subject_type === "projection");

  // Public attribution (public=true only — never expose participant_id)
  const { data: attrRecord } = await svc
    .from("attribution_record")
    .select("attribution_id")
    .eq("attribution_id", master.attribution_ref)
    .single();

  const { data: attrEntries } = attrRecord
    ? await svc
        .from("attribution_entry")
        .select("role_type")
        .eq("attribution_id", attrRecord.attribution_id)
        .eq("public", true)
    : { data: [] };

  // Media binding — public only
  const { data: binding } = await svc
    .from("projection_media_binding")
    .select("binding_type, access_level, asset_id")
    .eq("projection_id", proj.projection_id)
    .eq("binding_type", "primary")
    .eq("access_level", "public")
    .single();

  let media: WorldData["media"] = null;
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
      // Only expose playback_id when it's a real Livepeer asset (storage_ref = Livepeer asset id)
      playback_id: isPlaceholder ? null : (asset?.storage_ref ?? null),
      is_placeholder: isPlaceholder,
    };
  }

  const world: WorldData = {
    master: { master_id: master.master_id, canonical_type: master.canonical_type },
    canonical_state: {
      canonical_state_id: cs.canonical_state_id,
      version: cs.version,
      authorisation_state: cs.authorisation_state,
      integrity_hash: cs.integrity_hash,
      created_at: cs.created_at,
    },
    projection: {
      projection_id: proj.projection_id,
      projection_type: proj.projection_type,
      collectible_designated: proj.collectible_designated,
      integrity_hash: proj.integrity_hash,
    },
    provenance: {
      canonical_state: {
        relationship_type: provCS?.relationship_type ?? "",
        integrity_hash: provCS?.integrity_hash ?? "",
      },
      projection: {
        relationship_type: provProj?.relationship_type ?? "",
        integrity_hash: provProj?.integrity_hash ?? "",
      },
    },
    attribution: {
      roles: (attrEntries ?? []).map((e) => ({ role_type: e.role_type })),
    },
    media,
  };

  return NextResponse.json(world);
}
