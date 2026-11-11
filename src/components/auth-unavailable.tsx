import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AuthUnavailable({ mode }: { mode: "sign-in" | "sign-up" }) {
  const title =
    mode === "sign-in" ? "Sign-in isn't configured" : "Sign-up isn't configured";
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-lg flex-col justify-center gap-4 px-5 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Add the Clerk keys to create accounts. You can still train as a guest.
      </p>
      <Button asChild className="h-11 w-fit px-4">
        <Link href="/train">Start training</Link>
      </Button>
    </main>
  );
}
