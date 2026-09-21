import { headers } from "next/headers";
import { publicAppOriginFromHeaders } from "@/lib/auth-origin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import SignInForm from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const query = await searchParams;
  const redirectOrigin = publicAppOriginFromHeaders(await headers());
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div
            className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: "var(--accent-mv)" }}
          >
            MV
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Mighty Verse
          </p>
        </div>
        <Card className="bg-card/80">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Enter your email to receive a sign-in link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignInForm next={query.next} redirectOrigin={redirectOrigin} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
