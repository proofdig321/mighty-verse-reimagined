import SignInForm from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <h1 className="text-foreground text-lg font-medium">Sign in</h1>
        <SignInForm next={query.next} />
      </div>
    </main>
  );
}
