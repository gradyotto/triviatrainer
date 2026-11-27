"use client";

import { useEffect, useRef, useState } from "react";
import { LimitPrompt } from "@/components/billing/limit-prompt";
import { CategoryPicker } from "@/components/train/category-picker";
import { QuestionCard } from "@/components/train/question-card";
import { SessionSummary } from "@/components/train/session-summary";
import { Button } from "@/components/ui/button";
import { caughtUpCopy } from "@/lib/review/copy";
import { browserTimeZone } from "@/lib/time/zone";
import type {
  PublicQuestion,
  ReviewItem,
  CategorySummary,
} from "@/lib/train-types";

type Phase = "pick" | "loading" | "play" | "summary" | "limit" | "caught-up";
type SessionMode = "train" | "review";

export function TrainSession({
  categories,
  accountsEnabled = false,
  signedIn = false,
  review = null,
  highlightReview = false,
}: {
  categories: CategorySummary[];
  accountsEnabled?: boolean;
  signedIn?: boolean;
  review?: { dueCount: number; nextReviewLabel: string | null } | null;
  highlightReview?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [persisted, setPersisted] = useState(false);
  const [sessionSignedIn, setSessionSignedIn] = useState(false);
  const [dueCount, setDueCount] = useState(review?.dueCount ?? 0);
  const [queueLabel, setQueueLabel] = useState<string | null>(
    review?.nextReviewLabel ?? null,
  );
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [mode, setMode] = useState<SessionMode>("train");
  const [nextReviewLabel, setNextReviewLabel] = useState<string | null>(
    review?.nextReviewLabel ?? null,
  );
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (phase !== "pick" || !signedIn) return;
    const timeZone = browserTimeZone();
    const query = new URLSearchParams({ category: "review", summary: "1" });
    if (timeZone) query.set("timeZone", timeZone);
    void fetch(`/api/train/questions?${query.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          dueCount?: number;
          nextReviewLabel?: string | null;
        };
      })
      .then((body) => {
        if (!body || typeof body.dueCount !== "number") return;
        setDueCount(body.dueCount);
        setQueueLabel(body.nextReviewLabel ?? null);
      })
      .catch(() => undefined);
  }, [phase, signedIn]);

  useEffect(() => {
    if (phase !== "summary" || !sessionId) return;
    const durationSeconds = Math.max(
      0,
      Math.round((Date.now() - startedAt.current) / 1000),
    );
    void fetch(`/api/train/sessions/${sessionId}/finish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ durationSeconds }),
    }).catch(() => undefined);
  }, [phase, sessionId]);

  async function start(category: string | null, nextMode: SessionMode = "train") {
    setPhase("loading");
    setError(null);
    setMode(nextMode);
    const timeZone = browserTimeZone();
    try {
      const questionResponse = await fetch(
        `/api/train/questions?category=${encodeURIComponent(
          nextMode === "review" ? "review" : (category ?? "mixed"),
        )}${timeZone ? `&timeZone=${encodeURIComponent(timeZone)}` : ""}`,
        { cache: "no-store" },
      );
      const questionBody = (await questionResponse.json().catch(() => null)) as
        | {
            questions?: PublicQuestion[];
            error?: string;
            limitReached?: boolean;
            limit?: number | null;
            remaining?: number | null;
            caughtUp?: boolean;
            nextReviewLabel?: string | null;
          }
        | null;
      if (questionResponse.status === 401) {
        setError(questionBody?.error ?? "Sign in to review questions you've seen.");
        setPhase("pick");
        return;
      }
      if (questionResponse.ok && questionBody?.limitReached) {
        setDailyLimit(questionBody.limit ?? null);
        setPhase("limit");
        return;
      }
      if (questionResponse.ok && questionBody?.caughtUp) {
        setNextReviewLabel(questionBody.nextReviewLabel ?? null);
        setPhase("caught-up");
        return;
      }
      if (!questionResponse.ok || !questionBody?.questions?.length) {
        throw new Error(questionBody?.error ?? "Could not load questions");
      }
      const sessionResponse = await fetch("/api/train/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: nextMode === "review" ? null : category,
          mode: nextMode,
          timeZone,
        }),
      });
      const sessionBody = sessionResponse.ok
        ? ((await sessionResponse.json()) as {
            sessionId?: string | null;
            persisted?: boolean;
            signedIn?: boolean;
          })
        : { sessionId: null, persisted: false, signedIn: false };
      if (sessionBody.signedIn && !sessionBody.sessionId) {
        throw new Error("Couldn't start a saved round. Try again.");
      }

      startedAt.current = Date.now();
      setQuestions(questionBody.questions);
      setIndex(0);
      setReviews([]);
      setSessionId(sessionBody.sessionId ?? null);
      setPersisted(Boolean(sessionBody.persisted));
      setSessionSignedIn(Boolean(sessionBody.signedIn));
      setRemaining(
        typeof questionBody.remaining === "number" ? questionBody.remaining : null,
      );
      setPhase("play");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not start training",
      );
      setPhase("pick");
    }
  }

  function reset() {
    setPhase("pick");
    setQuestions([]);
    setIndex(0);
    setReviews([]);
    setSessionId(null);
    setPersisted(false);
    setSessionSignedIn(false);
    setDailyLimit(null);
    setRemaining(null);
    setMode("train");
    setError(null);
  }

  if (phase === "caught-up") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {caughtUpCopy(nextReviewLabel)}
          </p>
        </div>
        <Button type="button" variant="outline" className="h-11" onClick={reset}>
          Pick a set
        </Button>
      </div>
    );
  }

  if (phase === "limit") {
    return <LimitPrompt limit={dailyLimit} />;
  }

  if (phase === "loading") {
    return <p className="text-sm text-muted-foreground">Loading questions…</p>;
  }

  if (phase === "summary") {
    return (
      <SessionSummary
        reviews={reviews}
        persisted={persisted}
        showSignup={accountsEnabled && !sessionSignedIn}
        onAgain={reset}
      />
    );
  }

  const question = questions[index];
  if (phase === "play" && question) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          {mode === "review"
            ? remaining != null && remaining <= 5
              ? `Reviewing due questions. ${remaining} free questions left today.`
              : persisted
                ? "Reviewing due questions. Answers are saved."
                : "Reviewing due questions."
            : persisted
              ? remaining != null && remaining <= 5
                ? `Saving attempts. ${remaining} free questions left today.`
                : "Saving attempts to your account."
              : "This round is not saved."}
        </p>
        <QuestionCard
          key={question.id}
          question={question}
          index={index}
          total={questions.length}
          sessionId={sessionId}
          onGraded={(review) => setReviews((current) => [...current, review])}
          onLimit={(limit) => {
            setDailyLimit(limit);
            setPhase("limit");
          }}
          onNext={() => {
            if (index + 1 >= questions.length) setPhase("summary");
            else setIndex(index + 1);
          }}
          onEnd={() => {
            if (reviews.length === 0) reset();
            else setPhase("summary");
          }}
          context={mode === "review" ? "review" : "train"}
        />
      </div>
    );
  }

  return (
    <CategoryPicker
      categories={categories}
      error={error}
      signedIn={signedIn}
      accountsEnabled={accountsEnabled}
      dueCount={dueCount}
      nextReviewLabel={queueLabel}
      highlightReview={highlightReview}
      onSelect={(category) => void start(category)}
      onReview={() => void start(null, "review")}
    />
  );
}
