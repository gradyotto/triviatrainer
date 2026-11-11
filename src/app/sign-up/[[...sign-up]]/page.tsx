import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";
import { AuthUnavailable } from "@/components/auth-unavailable";
import { isClerkConfigured } from "@/lib/env";

export default function SignUpPage() {
  if (!isClerkConfigured()) {
    return <AuthUnavailable mode="sign-up" />;
  }

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-6 py-12">
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Loading sign up…</p>}
      >
        <SignUp />
      </Suspense>
    </main>
  );
}
