import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { validateAuthority, getServiceClient } from "@/lib/authority/validate";

// PATCH /api/authority/masters/sort-order
// Body: { orders: { master_id: string; sort_order: number }[] }
// Sets canonical sort_order for Scene masters. Authority-gated.
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participantId = await getParticipantId(supabase);
  if (!participantId) return NextResponse.json({ error: "No participant record" }, { status: 403 });

  const { orders } = await request.json() as { orders: { master_id: string; sort_order: number }[] };
  if (!Array.isArray(orders) || orders.length === 0) {
    return NextResponse.json({ error: "orders array required" }, { status: 400 });
  }

  const auth = await validateAuthority(participantId, "create-canonical-state", null);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 403 });

  const svc = getServiceClient();

  // Verify all masters are scenes
  const ids = orders.map((o) => o.master_id);
  const { data: masters } = await svc.from("master").select("master_id, canonical_type").in("master_id", ids);
  const nonScene = (masters ?? []).find((m) => m.canonical_type !== "scene");
  if (nonScene) return NextResponse.json({ error: `Master ${nonScene.master_id} is not a scene` }, { status: 400 });

  // Apply each sort_order update
  const results = await Promise.all(
    orders.map(({ master_id, sort_order }) =>
      svc.from("master").update({ sort_order }).eq("master_id", master_id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  return NextResponse.json({ updated: orders.length });
}
