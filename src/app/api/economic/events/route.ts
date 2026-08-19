import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processSignalAttribution } from "@/lib/media/attribution";

// POST /api/economic/events
// Body: { signal_id: string }
// Called by n8n webhook or directly. Authenticated or service_role only.
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

    const result = await processSignalAttribution(signal_id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
