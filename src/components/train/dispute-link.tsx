"use client";

import { useState } from "react";

export function DisputeLink({
  questionId,
  response,
  context,
}: {
  questionId: string;
  response: string;
  context: "train" | "review" | "daily";
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  async function submit() {
    if (state === "saving" || state === "saved") return;
    setState("saving");
    try {
      const result = await fetch("/api/disputes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId, response, context }),
      });
      setState(result.ok ? "saved" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "saved") {
    return (
      <p className="text-sm">Noted. We&apos;ll take another look.</p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        className="text-sm underline underline-offset-4 disabled:opacity-60"
        onClick={() => void submit()}
        disabled={state === "saving"}
      >
        {state === "saving" ? "Saving…" : "I think I was right"}
      </button>
      {state === "error" ? (
        <p className="text-sm text-destructive" role="alert">
          Could not save that. Try again.
        </p>
      ) : null}
    </div>
  );
}
