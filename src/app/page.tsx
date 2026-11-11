import { Show } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { isClerkConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

function AccountActions() {
  return (
    <>
      <Show when="signed-out">
        <Button asChild variant="outline" className="h-11 px-4">
          <Link href="/sign-in">Sign in to save progress</Link>
        </Button>
      </Show>
      <Show when="signed-in">
        <Button asChild variant="outline" className="h-11 px-4">
          <Link href="/stats">View your stats</Link>
        </Button>
      </Show>
    </>
  );
}

export default function HomePage() {
  const clerkEnabled = isClerkConfigured();

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-lg flex-col justify-center gap-8 px-5 py-12 pb-[max(3rem,env(safe-area-inset-bottom))]">
      <h1 className="text-center text-4xl font-bold tracking-tight text-balance">
        Trivia Trainer
      </h1>
      <div className="flex flex-col gap-3">
        <Button asChild className="h-11 px-4">
          <Link href="/train">Start training</Link>
        </Button>
        {clerkEnabled ? (
          <Suspense fallback={<div className="h-11" aria-hidden />}>
            <AccountActions />
          </Suspense>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Guest play is on. Accounts show up once Clerk keys are configured.
          </p>
        )}
      </div>
    </main>
  );
}
