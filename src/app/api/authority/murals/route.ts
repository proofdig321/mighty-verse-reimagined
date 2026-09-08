import { NextResponse } from "next/server";

import { loadUniverseAssociationTarget } from "@/lib/assemble/load-studio";
import {
  decideMuralRegistration,
  isUniverseId,
  resolveMuralTitle,
} from "@/lib/assemble/mural-registration";
import {
  createCanonicalState,
  createProjection,
  registerMaster,
} from "@/lib/authority/operations";
import { getServiceClient, validateAuthority } from "@/lib/authority/validate";
import { getParticipantId } from "@/lib/supabase/participant";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/authority/murals
 *
 * Body: { universe_id, title? }
 *
 * Registers the Universe's Mural container by composing the existing
 * registerMaster → createCanonicalState → createProjection path.
 * Does not attach media, create Scenes, or populate media_realization.
 * Idempotent when the Universe already has a Mural projection.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) {
    return NextResponse.json({ error: "No participant record" }, { status: 403 });
  }

  const json = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!json || typeof json !== "object") {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }

  const universeId =
    typeof json.universe_id === "string" ? json.universe_id.trim() : "";
  const requestedTitle =
    typeof json.title === "string" ? json.title.trim() : undefined;

  if (!isUniverseId(universeId)) {
    return NextResponse.json(
      { error: "universe_id required", reason: "invalid_universe" },
      { status: 400 },
    );
  }
  if (requestedTitle && requestedTitle.length > 200) {
    return NextResponse.json({ error: "title is too long" }, { status: 400 });
  }

  const auth = await validateAuthority(
    participantId,
    "create-canonical-state",
    universeId,
  );
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 403 });
  }

  const svc = getServiceClient();
  const { data: universe, error: universeError } = await svc
    .from("master")
    .select("master_id, canonical_type")
    .eq("master_id", universeId)
    .maybeSingle();

  if (universeError) {
    return NextResponse.json({ error: universeError.message }, { status: 500 });
  }

  const target = universe?.canonical_type === "universe"
    ? await loadUniverseAssociationTarget(universeId)
    : null;

  const decision = decideMuralRegistration({
    universeId,
    universeCanonicalType: universe?.canonical_type ?? null,
    existingMuralId: target?.mural_id ?? null,
    existingProjectionId: target?.projection_id ?? null,
  });

  if (decision.action === "reject") {
    if (decision.reason === "not_found") {
      return NextResponse.json(
        { error: "Universe not found.", reason: "not_found" },
        { status: 404 },
      );
    }
    if (decision.reason === "not_universe") {
      return NextResponse.json(
        {
          error: "Mural registration requires an existing Universe.",
          reason: "not_universe",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Invalid Universe.", reason: decision.reason },
      { status: 400 },
    );
  }

  const title = resolveMuralTitle({
    requestedTitle,
    universeTitle: target?.universe_title ?? target?.mural_title ?? null,
  });

  if (decision.action === "already_registered") {
    return NextResponse.json({
      ok: true,
      registration: "already_registered",
      universe_id: universeId,
      mural_id: decision.muralId,
      projection_id: decision.projectionId,
      title: target?.mural_title ?? title,
      created: {
        master: false,
        state: false,
        projection: false,
      },
    });
  }

  try {
    let muralId =
      decision.action === "complete_projection" ? decision.muralId : "";
    let createdMaster = false;
    let createdState = false;
    let canonicalStateId: string | null = null;

    if (decision.action === "register") {
      const master = await registerMaster(
        participantId,
        "mural",
        universeId,
        title,
      );
      if ("error" in master) {
        return NextResponse.json(
          { error: master.error },
          { status: operationStatus(master.error) },
        );
      }
      muralId = master.data.master_id;
      createdMaster = true;
    } else {
      const { data: mural } = await svc
        .from("master")
        .select("current_state_id")
        .eq("master_id", muralId)
        .maybeSingle();
      canonicalStateId = mural?.current_state_id ?? null;
    }

    if (!canonicalStateId) {
      const state = await createCanonicalState(participantId, muralId, null);
      if ("error" in state) {
        return NextResponse.json(
          { error: state.error },
          { status: operationStatus(state.error) },
        );
      }
      canonicalStateId = state.data.canonical_state_id;
      createdState = true;
    }

    const projection = await createProjection(
      participantId,
      canonicalStateId,
      muralId,
      "experiential",
    );
    if ("error" in projection) {
      return NextResponse.json(
        { error: projection.error },
        { status: operationStatus(projection.error) },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        registration:
          decision.action === "register" ? "registered" : "projection_completed",
        universe_id: universeId,
        mural_id: muralId,
        projection_id: projection.data.projection_id,
        title,
        created: {
          master: createdMaster,
          state: createdState,
          projection: true,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to register mural";
    return NextResponse.json(
      { error: message },
      { status: operationStatus(message) },
    );
  }
}

function operationStatus(message: string): number {
  if (/AuthorityRecord|does not grant capability|Unauthorized/i.test(message)) {
    return 403;
  }
  if (/not found/i.test(message)) return 404;
  if (/already exists|duplicate|unique|must be a universe/i.test(message)) {
    return 409;
  }
  return 500;
}
