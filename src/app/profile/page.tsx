import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantId } from "@/lib/supabase/participant";
import { getServiceClient } from "@/lib/authority/validate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import SignOutButton from "./sign-out-button";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");
  const u = user!;

  const participantId = await getParticipantId(supabase);

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

  const visibleLinks = identityLinks.filter((l) => l.identity_type !== "other");

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-sm px-4 pt-12 pb-16 space-y-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Account</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Profile</h1>
        </div>

        <Card className="bg-card/80">
          <CardHeader>
            <CardTitle className="text-sm">Account</CardTitle>
            <CardDescription>{u.email ?? "—"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Participant status</p>
              {participantId ? (
                <Badge variant="secondary">Active</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">Not linked</Badge>
              )}
            </div>
            {visibleLinks.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Verified identities</p>
                  <div className="flex flex-wrap gap-2">
                    {visibleLinks.map((l, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <Badge variant="outline" className="capitalize">
                          {l.identity_type.replace(/-/g, " ")}
                        </Badge>
                        {l.verified && (
                          <span className="text-[10px] text-emerald-400">verified</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <SignOutButton />
      </div>
    </div>
  );
}
