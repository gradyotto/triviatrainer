import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";
import { AuthUnavailable } from "@/components/auth-unavailable";
import { isClerkConfigured } from "@/lib/env";

function safeRedirect(value: string | undefined): string | undefined {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  if (!isClerkConfigured()) {
    return <AuthUnavailable mode="sign-up" />;
  }
  const params = await searchParams;
  const redirectUrl = safeRedirect(params.redirect_url);

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-6 py-12">
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Loading sign up…</p>}
      >
        <SignUp
          fallbackRedirectUrl={redirectUrl}
          forceRedirectUrl={redirectUrl}
        />
      </Suspense>
    </main>
  );
}
