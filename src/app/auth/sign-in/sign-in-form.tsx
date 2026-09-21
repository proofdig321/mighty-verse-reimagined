"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeAuthNext } from "@/lib/auth-next";
import { authEmailRedirectTo } from "@/lib/auth-origin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

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
      options: { emailRedirectTo: authEmailRedirectTo(redirectOrigin, destination) },
    });
    if (error) setError(error.message);
    else setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <Alert className="border-emerald-500/30 bg-emerald-500/10">
        <CheckCircle2 size={14} className="text-emerald-400" />
        <AlertDescription className="text-emerald-300">
          Check your email for a sign-in link.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle size={14} />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Sending…" : "Send sign-in link"}
      </Button>
    </form>
  );
}
