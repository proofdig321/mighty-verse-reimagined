import SignInForm from "./sign-in-form";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 px-4">
        <h1 className="text-foreground text-lg font-medium">Sign in</h1>
        <SignInForm />
      </div>
    </main>
  );
}
