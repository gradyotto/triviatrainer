import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isClerkConfigured } from "@/lib/env";

export default function HomePage() {
  const clerkEnabled = isClerkConfigured();

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-lg flex-col justify-center gap-6 px-5 py-12 pb-[max(3rem,env(safe-area-inset-bottom))]">
      <p className="text-sm font-medium tracking-wide text-muted-foreground">
        TriviaTrainer
      </p>
      <h1 className="text-4xl font-semibold tracking-tight text-balance">
        Train for bar trivia.
      </h1>
      <p className="text-base leading-relaxed text-muted-foreground">
        Multiple choice and fill-in, one question at a time, with the right
        answer as soon as you lock yours in.
      </p>
      <div className="flex flex-col gap-3">
        <Button asChild className="h-11 px-4">
          <Link href="/train">Start training</Link>
        </Button>
        {clerkEnabled ? (
          <Button asChild variant="outline" className="h-11 px-4">
            <Link href="/sign-in">Sign in to save progress</Link>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Guest play is on. Accounts show up once Clerk keys are configured.
          </p>
        )}
      </div>
    </main>
  );
}
