import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LimitPrompt({ limit }: { limit: number | null }) {
  const allowance =
    limit == null ? "today's free questions" : `today's ${limit} free questions`;
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card px-4 py-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          That&apos;s the free set for today
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          You&apos;ve used {allowance}. They reset at midnight in your time
          zone. Pro training is unlimited.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="h-11 px-4">
          <Link href="/upgrade">See Pro plans</Link>
        </Button>
        <Button asChild variant="outline" className="h-11 px-4">
          <Link href="/stats">View stats</Link>
        </Button>
      </div>
    </div>
  );
}
