"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeAuthNext } from "@/lib/auth-next";
import { authEmailRedirectTo } from "@/lib/auth-origin";

export default function SignInForm({
  next,
  redirectOrigin,
}: {
  next?: string | null;
  redirectOrigin: string;
}) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const destination = safeAuthNext(next);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: authEmailRedirectTo(redirectOrigin, destination),
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSubmitted(true);
    }
    setLoading(false);
  }

  if (submitted) {
    return (
      <p className="text-muted-foreground text-sm">
        Check your email for a sign-in link.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="text-foreground text-sm">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-input bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/50"
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-primary text-primary-foreground w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Sending…" : "Send sign-in link"}
      </button>
    </form>
  );
}
