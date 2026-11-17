"use client";

import { useEffect, useRef, useState } from "react";
import { LimitPrompt } from "@/components/billing/limit-prompt";
import { CategoryPicker } from "@/components/train/category-picker";
import { QuestionCard } from "@/components/train/question-card";
import { SessionSummary } from "@/components/train/session-summary";
import { browserTimeZone } from "@/lib/time/zone";
import type {
  PublicQuestion,
  ReviewItem,
  CategorySummary,
} from "@/lib/train-types";

type Phase = "pick" | "loading" | "play" | "summary" | "limit";

export function TrainSession({
  categories,
  accountsEnabled = false,
}: {
  categories: CategorySummary[];
  accountsEnabled?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [persisted, setPersisted] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const startedAt = useRef(Date.now());

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

  async function start(category: string | null) {
    setPhase("loading");
    setError(null);
    const timeZone = browserTimeZone();
    try {
      const questionResponse = await fetch(
        `/api/train/questions?category=${encodeURIComponent(category ?? "mixed")}${
          timeZone ? `&timeZone=${encodeURIComponent(timeZone)}` : ""
        }`,
        { cache: "no-store" },
      );
      const questionBody = (await questionResponse.json().catch(() => null)) as
        | {
            questions?: PublicQuestion[];
            error?: string;
            limitReached?: boolean;
            limit?: number | null;
            remaining?: number | null;
          }
        | null;
      if (questionResponse.ok && questionBody?.limitReached) {
        setDailyLimit(questionBody.limit ?? null);
        setPhase("limit");
        return;
      }
      if (!questionResponse.ok || !questionBody?.questions?.length) {
        throw new Error(questionBody?.error ?? "Could not load questions");
      }
      const sessionResponse = await fetch("/api/train/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, timeZone }),
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
      setSignedIn(Boolean(sessionBody.signedIn));
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
    setSignedIn(false);
    setDailyLimit(null);
    setRemaining(null);
    setError(null);
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
        showSignup={accountsEnabled && !signedIn}
        onAgain={reset}
      />
    );
  }

  const question = questions[index];
  if (phase === "play" && question) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          {persisted
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
        />
      </div>
    );
  }

  return (
    <CategoryPicker categories={categories} error={error} onSelect={(category) => void start(category)} />
  );
}
