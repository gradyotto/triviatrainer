"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { caughtUpCopy } from "@/lib/review/copy";
import type { CategorySummary } from "@/lib/train-types";

const SESSION_SIZE = 10;

export function CategoryPicker({
  categories,
  error,
  onSelect,
  onReview,
  signedIn = false,
  accountsEnabled = false,
  dueCount = 0,
  nextReviewLabel = null,
  highlightReview = false,
}: {
  categories: CategorySummary[];
  error: string | null;
  onSelect: (category: string | null) => void;
  onReview: () => void;
  signedIn?: boolean;
  accountsEnabled?: boolean;
  dueCount?: number;
  nextReviewLabel?: string | null;
  highlightReview?: boolean;
}) {
  const total = categories.reduce(
    (sum, category) => sum + category.questionCount,
    0,
  );
  const mixedCount = Math.min(SESSION_SIZE, total);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pick a set</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          One question at a time. You get the answer as soon as you lock yours in.
        </p>
      </div>
      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive-soft px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No questions are available yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {signedIn ? (
            <Button
              type="button"
              variant="outline"
              className={`h-auto min-h-12 w-full justify-start px-4 py-3 text-base ${
                highlightReview ? "ring-2 ring-ring" : ""
              }`}
              onClick={onReview}
            >
              <span className="text-left">
                <span className="block font-medium">Review</span>
                <span className="block text-sm font-normal opacity-80">
                  {dueCount > 0
                    ? `${dueCount} due`
                    : nextReviewLabel
                      ? caughtUpCopy(nextReviewLabel)
                      : "0 due"}
                </span>
              </span>
            </Button>
          ) : accountsEnabled ? (
            <Button
              asChild
              variant="outline"
              className="h-auto min-h-12 w-full justify-start px-4 py-3 text-base"
            >
              <Link href="/sign-in">
                <span className="text-left">
                  <span className="block font-medium">Review</span>
                  <span className="block text-sm font-normal opacity-80">
                    Sign in to review questions you&apos;ve seen
                  </span>
                </span>
              </Link>
            </Button>
          ) : null}
          <Button
            type="button"
            className="h-auto min-h-12 w-full justify-start px-4 py-3 text-base"
            onClick={() => onSelect(null)}
          >
            <span className="text-left">
              <span className="block font-medium">Mixed</span>
              <span className="block text-sm font-normal opacity-80">
                {mixedCount} from every category
              </span>
            </span>
          </Button>
          {categories.map((category) => (
            <Button
              key={category.slug}
              type="button"
              variant="outline"
              className="h-auto min-h-12 w-full justify-start px-4 py-3 text-base"
              onClick={() => onSelect(category.slug)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
