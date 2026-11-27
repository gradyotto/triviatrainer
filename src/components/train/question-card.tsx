"use client";

import { useRef, useState } from "react";
import { DisputeLink } from "@/components/train/dispute-link";
import { Button } from "@/components/ui/button";
import { browserTimeZone } from "@/lib/time/zone";
import type { GradeResult, PublicQuestion, ReviewItem } from "@/lib/train-types";

export function QuestionCard({
  question,
  index,
  total,
  sessionId,
  onGraded,
  onNext,
  onEnd,
  onLimit,
  context = "train",
}: {
  question: PublicQuestion;
  index: number;
  total: number;
  sessionId: string | null;
  onGraded: (review: ReviewItem) => void;
  onNext: () => void;
  onEnd: () => void;
  onLimit: (limit: number | null) => void;
  context?: "train" | "review";
}) {
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<GradeResult | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reported = useRef(false);
  const shownAt = useRef(Date.now());

  async function submit(value: string) {
    if (feedback || submitting) return;
    setSubmitting(true);
    setError(null);
    setSelected(value);
    try {
      const response = await fetch("/api/train/answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          response: value,
          sessionId,
          usedHint: hintVisible,
          responseMs: Math.max(0, Date.now() - shownAt.current),
          timeZone: browserTimeZone(),
        }),
      });
      if (response.status === 402) {
        const body = (await response.json().catch(() => null)) as
          | { limit?: number | null }
          | null;
        onLimit(body?.limit ?? null);
        return;
      }
      if (!response.ok) {
        setError("Could not check that answer. Try again.");
        setSubmitting(false);
        return;
      }
      const result = (await response.json()) as GradeResult;
      setFeedback(result);
      if (!reported.current) {
        reported.current = true;
        onGraded({
          prompt: question.prompt,
          response: value,
          correct: result.correct,
          answer: result.answer,
          explanation: result.explanation,
        });
      }
    } catch {
      setError("Could not check that answer. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const progress = Math.round(((index + (feedback ? 1 : 0)) / total) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Question {index + 1} of {total}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onEnd}>
          End
        </Button>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        aria-hidden="true"
      >
        <div
          className="h-full bg-primary transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {question.categoryName} · {question.type === "multiple_choice" ? "Multiple choice" : "Fill-in"}
      </p>
      <h1 className="text-xl font-semibold leading-snug tracking-tight text-balance">
        {question.prompt}
      </h1>
      {question.hint && !feedback ? (
        hintVisible ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            {question.hint}
          </p>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start px-0"
            onClick={() => setHintVisible(true)}
          >
            Show hint
          </Button>
        )
      ) : null}

      {question.type === "multiple_choice" && question.options ? (
        <div className="flex flex-col gap-2">
          {question.options.map((option) => {
            const isAnswer = feedback?.answer === option;
            const isSelected = selected === option;
            return (
              <Button
                key={option}
                type="button"
                variant="outline"
                disabled={Boolean(feedback) || submitting}
                className={`h-auto min-h-12 w-full justify-start px-4 py-3 text-left text-base whitespace-normal ${
                  feedback && isAnswer
                    ? "border-success bg-success-soft text-success-foreground"
                    : feedback && isSelected
                      ? "border-destructive bg-destructive-soft text-destructive"
                      : ""
                }`}
                onClick={() => void submit(option)}
              >
                {option}
              </Button>
            );
          })}
        </div>
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim()) void submit(draft);
          }}
        >
          <label className="text-sm font-medium" htmlFor="fill-in-answer">
            Your answer
          </label>
          <input
            id="fill-in-answer"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={Boolean(feedback) || submitting}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          />
          {!feedback ? (
            <Button
              type="submit"
              className="h-11"
              disabled={submitting || draft.trim().length === 0}
            >
              {submitting ? "Checking…" : "Lock it in"}
            </Button>
          ) : null}
        </form>
      )}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {feedback ? (
        <div
          role="status"
          className={`flex flex-col gap-1 rounded-xl border px-4 py-3 ${
            feedback.correct
              ? "border-success bg-success-soft text-success-foreground"
              : "border-destructive bg-destructive-soft"
          }`}
        >
          <p className="font-medium">
            {feedback.correct ? "Correct" : "Not quite"}
          </p>
          <p className="text-sm">
            Answer: <span className="font-medium">{feedback.answer}</span>
          </p>
          {feedback.explanation ? (
            <p className="text-sm leading-relaxed opacity-90">
              {feedback.explanation}
            </p>
          ) : null}
          {feedback.correct ? null : (
            <DisputeLink
              questionId={question.id}
              response={selected ?? draft}
              context={context}
            />
          )}
        </div>
      ) : null}

      {feedback ? (
        <Button type="button" className="h-11" onClick={onNext}>
          {index + 1 >= total ? "See results" : "Next question"}
        </Button>
      ) : null}
    </div>
  );
}
