"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ReviewItem } from "@/lib/train-types";

export function SessionSummary({
  reviews,
  persisted,
  onAgain,
}: {
  reviews: ReviewItem[];
  persisted: boolean;
  onAgain: () => void;
}) {
  const correctCount = reviews.filter((review) => review.correct).length;
  const percent =
    reviews.length === 0
      ? 0
      : Math.round((correctCount / reviews.length) * 100);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted-foreground">Session</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {correctCount}/{reviews.length}
        </h1>
        <p className="text-base text-muted-foreground">{percent}% correct</p>
        <p className="text-sm text-muted-foreground">
          {persisted
            ? "Saved to your account."
            : "Not saved. Sign in with a database connected to keep attempts."}
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {reviews.map((review, index) => (
          <li
            key={`${review.prompt}-${index}`}
            className="rounded-xl border border-border bg-card px-4 py-3"
          >
            <p className="text-sm font-medium leading-snug">{review.prompt}</p>
            <p
              className={`mt-2 text-sm ${review.correct ? "text-success-foreground" : "text-destructive"}`}
            >
              {review.correct ? "Correct" : `You said “${review.response || " "}”`}
            </p>
            {!review.correct ? (
              <p className="text-sm text-muted-foreground">
                Answer: {review.answer}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2">
        <Button type="button" className="h-11" onClick={onAgain}>
          Train again
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
