import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { recordConsumptionSignal } from "@/lib/media/signals";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectionId, masterId, canonicalStateId, signalType, sessionRef } = body;

    if (!projectionId || !masterId || !canonicalStateId || !signalType || !sessionRef) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Resolve participant — null for anonymous
    const supabase = await createClient();
    const participantId = await getParticipantId(supabase);

    // Verify projection exists using service client — projection table has RLS that
    // blocks anon reads, so the user-facing client would return 404 for every anonymous
    // play signal even though the projection is valid.
    const svc = getServiceClient();
    const { data: projection, error: projError } = await svc
      .from("projection")
      .select("projection_id")
      .eq("projection_id", projectionId)
      .single();

    if (projError || !projection) {
      return NextResponse.json({ error: "Projection not found" }, { status: 404 });
    }

    // attribution_confidence = 'high' only when projection_id is directly provided
    // and verified against the database
    await recordConsumptionSignal({
      sessionRef,
      participantRef: participantId,
      projectionId,
      masterId,
      canonicalStateId,
      signalType,
      occurredAt: new Date(),
      attributionConfidence: "high",
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
