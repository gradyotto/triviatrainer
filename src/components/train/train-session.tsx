"use client";

import { useEffect, useRef, useState } from "react";
import { CategoryPicker } from "@/components/train/category-picker";
import { QuestionCard } from "@/components/train/question-card";
import { SessionSummary } from "@/components/train/session-summary";
import type {
  PublicQuestion,
  ReviewItem,
  CategorySummary,
} from "@/lib/train-types";

type Phase = "pick" | "loading" | "play" | "summary";

export function TrainSession({
  categories,
}: {
  categories: CategorySummary[];
}) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [persisted, setPersisted] = useState(false);
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
    try {
      const [questionResponse, sessionResponse] = await Promise.all([
        fetch(
          `/api/train/questions?category=${encodeURIComponent(category ?? "mixed")}`,
          { cache: "no-store" },
        ),
        fetch("/api/train/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ category }),
        }),
      ]);
      const questionBody = (await questionResponse.json().catch(() => null)) as
        | { questions?: PublicQuestion[]; error?: string }
        | null;
      if (!questionResponse.ok || !questionBody?.questions?.length) {
        throw new Error(questionBody?.error ?? "Could not load questions");
      }
      const sessionBody = sessionResponse.ok
        ? ((await sessionResponse.json()) as {
            sessionId?: string | null;
            persisted?: boolean;
          })
        : { sessionId: null, persisted: false };

      startedAt.current = Date.now();
      setQuestions(questionBody.questions);
      setIndex(0);
      setReviews([]);
      setSessionId(sessionBody.sessionId ?? null);
      setPersisted(Boolean(sessionBody.persisted));
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
    setError(null);
  }

  if (phase === "loading") {
    return <p className="text-sm text-muted-foreground">Loading questions…</p>;
  }

  if (phase === "summary") {
    return (
      <SessionSummary reviews={reviews} persisted={persisted} onAgain={reset} />
    );
  }

  const question = questions[index];
  if (phase === "play" && question) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          {persisted
            ? "Saving attempts to your account."
            : "This round is not saved."}
        </p>
        <QuestionCard
          key={question.id}
          question={question}
          index={index}
          total={questions.length}
          sessionId={sessionId}
          onGraded={(review) => setReviews((current) => [...current, review])}
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
