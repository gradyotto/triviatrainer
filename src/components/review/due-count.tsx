import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { caughtUpCopy } from "@/lib/review/copy";
import { getReviewOverview } from "@/lib/review/service";

export async function ReviewDueCount() {
  if (!isClerkConfigured() || !isDatabaseConfigured()) return null;
  const clerkId = await getSignedInClerkId();
  if (!clerkId) return null;
  try {
    const overview = await getReviewOverview(clerkId);
    if (overview.dueCount > 0) {
      return (
        <Button asChild variant="outline" className="h-11 px-4">
          <Link href="/train?mode=review">Review {overview.dueCount} due</Link>
        </Button>
      );
    }
    return (
      <p className="text-center text-sm text-muted-foreground">
        {overview.nextReviewLabel
          ? caughtUpCopy(overview.nextReviewLabel)
          : "0 due"}
      </p>
    );
  } catch {
    console.error("Failed to load the review queue");
    return null;
  }
}
