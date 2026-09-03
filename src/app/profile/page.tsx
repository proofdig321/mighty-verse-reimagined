import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import SignOutButton from "./sign-out-button";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const participantId = await getParticipantId(supabase);

  // Fetch identity links for this participant (server-side only)
  const identityLinks = participantId
    ? await (async () => {
        const svc = getServiceClient();
        const { data } = await svc
          .from("identity_link")
          .select("identity_type, verified, active")
          .eq("participant_id", participantId)
          .eq("active", true);
        return data ?? [];
      })()
    : [];

  // Filter out the seed placeholder — only show real identity types
  const visibleLinks = identityLinks.filter(
    (l) => l.identity_type !== "other"
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-sm px-4 pt-12 pb-16 space-y-6">

        <div>
          <h1 className="text-foreground text-lg font-semibold">Profile</h1>
          <p className="text-muted-foreground text-xs mt-0.5">Your participant identity</p>
        </div>

        <Separator />

        {/* Auth identity */}
        <div className="space-y-1">
          <p className="text-foreground text-xs font-medium uppercase tracking-wider">Account</p>
          <p className="text-foreground text-sm">{user.email ?? "—"}</p>
        </div>

        {/* Participant status */}
        <div className="space-y-1">
          <p className="text-foreground text-xs font-medium uppercase tracking-wider">Participant</p>
          {participantId ? (
            <Badge variant="secondary">active</Badge>
          ) : (
            <p className="text-muted-foreground text-xs">No participant record linked yet.</p>
          )}
        </div>

        {/* Verified identity links (non-placeholder only) */}
        {visibleLinks.length > 0 && (
          <div className="space-y-2">
            <p className="text-foreground text-xs font-medium uppercase tracking-wider">Identities</p>
            <div className="flex flex-wrap gap-2">
              {visibleLinks.map((l, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Badge variant="outline" className="capitalize">{l.identity_type.replace(/-/g, " ")}</Badge>
                  {l.verified && <span className="text-muted-foreground text-xs">verified</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        <SignOutButton />
      </div>
    </div>
  );
}
