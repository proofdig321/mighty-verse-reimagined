import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordConsumptionEvent } from "@/lib/economic/events";

// POST /api/economic/events
// Body: { signal_id: string }
// Called by n8n (Step 14) or directly during testing.
// Authenticated or service_role only — no anonymous economic event creation.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { signal_id } = await request.json();
    if (!signal_id) {
      return NextResponse.json({ error: "signal_id required" }, { status: 400 });
    }

    const event_id = await recordConsumptionEvent(signal_id);
    return NextResponse.json({ event_id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
