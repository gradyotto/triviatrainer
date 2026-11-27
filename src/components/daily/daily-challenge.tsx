"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UsernameForm } from "@/components/account/username-form";
import { DisputeLink } from "@/components/train/dispute-link";
import { Button } from "@/components/ui/button";
import { formatGameDate } from "@/lib/daily/day";
import type { DailyPageState } from "@/lib/daily/types";

function Countdown({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  const remaining = now == null ? null : Math.max(0, new Date(endsAt).getTime() - now);
  const hours = remaining == null ? "--" : Math.floor(remaining / 3_600_000);
  const minutes =
    remaining == null ? "--" : Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = remaining == null ? "--" : Math.floor((remaining % 60_000) / 1000);

  return (
    <p className="text-sm text-muted-foreground">
      Next challenge in {hours}h {minutes}m {seconds}s
    </p>
  );
}

async function postDaily(path: string, body?: unknown): Promise<DailyPageState> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as
    | (DailyPageState & { error?: string })
    | null;
  if (!response.ok || !payload || typeof payload.phase !== "string") {
    throw new Error(payload?.error ?? "Something went wrong. Try again.");
  }
  return payload;
}

export function DailyChallenge({ initial }: { initial: DailyPageState }) {
  const [state, setState] = useState(initial);
  const [draft, setDraft] = useState("");
  const [bonusDraft, setBonusDraft] = useState("");
  const [hintVisible, setHintVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setState(initial);
  }, [initial]);

  async function run(task: () => Promise<DailyPageState>) {
    setBusy(true);
    setError(null);
    try {
      const next = await task();
      setState(next);
      setDraft("");
      setBonusDraft("");
      setHintVisible(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!state.available) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Daily Challenge</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {state.reason === "no_questions"
            ? "There aren't enough fill-in questions to build today's set."
            : "Today's challenge needs a database connection before it can start."}
        </p>
      </div>
    );
  }

  const dateLabel = state.gameDate ? formatGameDate(state.gameDate) : "Today";

  if (state.phase === "ready" && state.signedIn && state.needsUsername) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Daily Challenge</h1>
        <UsernameForm
          heading="Pick a username before you play"
          body="Your score goes on the leaderboard under this name. You can change it later from Account."
        />
      </div>
    );
  }

  if (state.phase === "ready") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {dateLabel}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Daily Challenge</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Everyone gets the same fill-in questions until midnight Phoenix time.
            One run today. It doesn&apos;t count against the free training limit.
          </p>
        </div>
        {state.nextStartsAt ? <Countdown endsAt={state.nextStartsAt} /> : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          className="h-11"
          disabled={busy}
          onClick={() => void run(() => postDaily("/api/daily/start"))}
        >
          {busy ? "Starting…" : "Start today's challenge"}
        </Button>
      </div>
    );
  }

  if (state.phase === "results" && state.result) {
    const result = state.result;
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {formatGameDate(result.gameDate)}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">{result.score} pts</h1>
          <p className="text-sm text-muted-foreground">
            {result.correctCount} of {result.total} correct
            {result.rank != null
              ? ` · Rank ${result.rank} of ${result.playerCount}`
              : ""}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card px-4 py-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Base</dt>
            <dd className="font-medium">{result.basePoints}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Speed</dt>
            <dd className="font-medium">{result.speedPoints}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Streak</dt>
            <dd className="font-medium">{result.streakPoints}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Bonus</dt>
            <dd className="font-medium">{result.bonusPoints}</dd>
          </div>
        </dl>
        <Countdown endsAt={result.nextStartsAt} />
        <pre className="overflow-x-auto rounded-xl bg-muted px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
          {result.shareText}
        </pre>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => {
            void navigator.clipboard
              .writeText(result.shareText)
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
        >
          {copied ? "Copied" : "Copy summary"}
        </Button>
        {state.signedIn && state.needsUsername ? (
          <UsernameForm
            heading="Post this score"
            body="Choose a username and this result shows up on the leaderboard."
          />
        ) : null}
        {!state.signedIn && state.accountsEnabled ? (
          <div className="flex flex-col gap-2 rounded-xl border border-border px-4 py-4">
            <p className="text-sm leading-relaxed">
              Sign up to save this score and appear on the leaderboard. This
              result stays attached to the browser until you do.
            </p>
            <Button asChild className="h-11">
              <Link href="/sign-up?redirect_url=/daily">Sign up to save</Link>
            </Button>
          </div>
        ) : null}
        {result.posted ? (
          <Button asChild variant="outline" className="h-11">
            <Link href="/leaderboard">View the leaderboard</Link>
          </Button>
        ) : null}
        <ol className="flex flex-col gap-3">
          {result.questions.map((question, index) => (
            <li key={`${question.prompt}-${index}`} className="text-sm">
              <p className="font-medium">
                {question.correct ? "Correct" : "Missed"} · {question.points} pts
              </p>
              <p className="text-muted-foreground">{question.prompt}</p>
              <p>
                You said {question.response}. Answer: {question.answer}
                {question.bonusPoints > 0 ? ` · Bonus +${question.bonusPoints}` : ""}
              </p>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const question = state.question;
  if (!question) {
    return (
      <p className="text-sm text-muted-foreground">
        Today&apos;s challenge could not be loaded.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Question {question.index + 1} of {question.total}
        </p>
        <p className="text-sm font-medium">{state.score} pts</p>
      </div>
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {question.categoryName} · {question.difficulty}
      </p>
      <h1 className="text-xl font-semibold leading-snug tracking-tight text-balance">
        {question.prompt}
      </h1>
      {question.hint && state.phase === "question" ? (
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

      {state.phase === "question" ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim()) {
              void run(() => postDaily("/api/daily/answer", { response: draft }));
            }
          }}
        >
          <label className="text-sm font-medium" htmlFor="daily-answer">
            Your answer
          </label>
          <input
            id="daily-answer"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button type="submit" className="h-11" disabled={busy || draft.trim().length === 0}>
            {busy ? "Checking…" : "Lock it in"}
          </Button>
        </form>
      ) : null}

      {state.feedback ? (
        <div
          role="status"
          className={`flex flex-col gap-2 rounded-xl border px-4 py-3 ${
            state.feedback.correct
              ? "border-success bg-success-soft text-success-foreground"
              : "border-destructive bg-destructive-soft"
          }`}
        >
          <p className="font-medium">
            {state.feedback.correct ? "Correct" : "Not quite"} · {state.feedback.points} pts
          </p>
          <p className="text-sm">
            Answer: <span className="font-medium">{state.feedback.answer}</span>
          </p>
          {state.feedback.correct ? (
            <p className="text-sm">
              Base {state.feedback.basePoints} · Speed {state.feedback.speedPoints} ·
              Streak {state.feedback.streakPoints}
            </p>
          ) : (
            <DisputeLink
              questionId={question.id}
              response={state.feedback.response}
              context="daily"
            />
          )}
          {state.feedback.explanation ? (
            <p className="text-sm leading-relaxed opacity-90">
              {state.feedback.explanation}
            </p>
          ) : null}
          {state.feedback.bonus ? (
            <p className="text-sm">
              Bonus{" "}
              {state.feedback.bonus.skipped
                ? "skipped"
                : state.feedback.bonus.correct
                  ? `correct +${state.feedback.bonus.points}`
                  : "missed"}
              . {state.feedback.bonus.answer}
            </p>
          ) : null}
        </div>
      ) : null}

      {state.phase === "bonus" && state.bonusPrompt ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() =>
              postDaily("/api/daily/bonus", { response: bonusDraft, skip: false }),
            );
          }}
        >
          <h2 className="text-base font-medium">{state.bonusPrompt}</h2>
          <p className="text-sm text-muted-foreground">
            Worth 50 points. Skipping or missing costs nothing.
          </p>
          <label className="text-sm font-medium" htmlFor="daily-bonus">
            Bonus answer
          </label>
          <input
            id="daily-bonus"
            value={bonusDraft}
            onChange={(event) => setBonusDraft(event.target.value)}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button type="submit" className="h-11" disabled={busy || bonusDraft.trim().length === 0}>
            {busy ? "Checking…" : "Answer bonus"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            disabled={busy}
            onClick={() =>
              void run(() => postDaily("/api/daily/bonus", { response: "", skip: true }))
            }
          >
            Skip bonus
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {state.phase === "feedback" ? (
        <Button
          type="button"
          className="h-11"
          disabled={busy}
          onClick={() => void run(() => postDaily("/api/daily/continue"))}
        >
          {busy
            ? "Loading…"
            : question.index + 1 >= question.total
              ? "See results"
              : "Next question"}
        </Button>
      ) : null}
    </div>
  );
}
