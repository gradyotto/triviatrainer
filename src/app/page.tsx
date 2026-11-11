import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-muted-foreground">
        TriviaTrainer
      </p>
      <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Train smarter for bar trivia.
      </h1>
      <p className="max-w-xl text-base text-muted-foreground text-pretty">
        Sign in to start spaced-repetition sessions with multiple-choice and
        fill-in drills tailored for bar trivia night.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/sign-up">Create account</Link>
        </Button>
      </div>
    </main>
  );
}
