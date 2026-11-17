import type { Metadata } from "next";
import { TrainSession } from "@/components/train/train-session";
import { getSignedInClerkId } from "@/lib/clerk-user";
import { isClerkConfigured, isDatabaseConfigured } from "@/lib/env";
import { listCategories } from "@/lib/questions";
import { getReviewOverview } from "@/lib/review/service";

export const metadata: Metadata = {
  title: "Train",
};

export default async function TrainPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const params = await searchParams;
  const { categories } = await listCategories();
  const clerkUserId = await getSignedInClerkId();
  let review: { dueCount: number; nextReviewLabel: string | null } | null = null;
  if (clerkUserId && isDatabaseConfigured()) {
    try {
      review = await getReviewOverview(clerkUserId);
    } catch {
      console.error("Failed to load the review queue");
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <TrainSession
        categories={categories}
        accountsEnabled={isClerkConfigured()}
        signedIn={Boolean(clerkUserId)}
        review={review}
        highlightReview={params.mode === "review"}
      />
    </main>
  );
}
