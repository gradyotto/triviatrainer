import Link from "next/link";
import { Button } from "@/components/ui/button";

const FEATURES = [
  "Accuracy trend over time",
  "Accuracy by category, week by week",
  "Strongest and weakest categories",
  "Accuracy by difficulty",
  "Average answer time",
  "A calendar of your training",
];

export function ProTeaser() {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Pro analytics</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Free includes the totals above. Pro adds the view of how those
          numbers move.
        </p>
      </div>
      <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
        {FEATURES.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <Button asChild className="h-11 w-fit px-4">
        <Link href="/upgrade">Unlock Pro stats</Link>
      </Button>
    </section>
  );
}
