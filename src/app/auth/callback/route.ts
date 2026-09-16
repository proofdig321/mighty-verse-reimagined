import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeAuthNext } from "@/lib/auth-next";
import { publicAppOrigin } from "@/lib/auth-origin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = publicAppOrigin(request);
  const code = searchParams.get("code");
  const next = safeAuthNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/sign-in?next=${encodeURIComponent(next)}`);
}
