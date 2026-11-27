"use client";

import Link from "next/link";
import { AnswerLines } from "@/components/answer-lines";
import { ArtworkFigure } from "@/components/artwork-figure";
import { Button } from "@/components/ui/button";
import type { ReviewItem } from "@/lib/train-types";

export function SessionSummary({
  reviews,
  persisted,
  showSignup,
  onAgain,
}: {
  reviews: ReviewItem[];
  persisted: boolean;
  showSignup: boolean;
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
            : showSignup
              ? "This round was not saved."
              : "Not saved. Sign in with a database connected to keep attempts."}
        </p>
      </div>
      {showSignup ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">Create an account</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Sign up to save your progress and track your stats.
            </p>
          </div>
          <Button asChild className="h-11 w-fit px-4">
            <Link href="/sign-up?redirect_url=/train">Create an account</Link>
          </Button>
        </div>
      ) : null}
      <ol className="flex flex-col gap-3">
        {reviews.map((review, index) => (
          <li
            key={`${review.prompt}-${index}`}
            className="rounded-xl border border-border bg-card px-4 py-3"
          >
            <p className="text-sm font-medium leading-snug">{review.prompt}</p>
            {review.image ? (
              <div className="mt-2">
                <ArtworkFigure image={review.image} />
              </div>
            ) : null}
            <p
              className={`mt-2 text-sm ${review.correct ? "text-success-foreground" : "text-destructive"}`}
            >
              {review.correct ? "Correct" : "Not quite"}
            </p>
            <AnswerLines response={review.response || " "} answer={review.answer} />
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
