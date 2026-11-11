import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-6 py-12">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading sign in…</p>}>
        <SignIn />
      </Suspense>
    </main>
  );
}
