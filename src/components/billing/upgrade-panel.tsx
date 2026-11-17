"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/config/plans";

type Interval = "month" | "year";

export function UpgradePanel({
  signedIn,
  plan,
  stripeReady,
  monthlyCents,
  yearlyCents,
  savedCents,
  savingsPercent,
  freeQuestions,
  freeAi,
  canceled,
}: {
  signedIn: boolean;
  plan: "free" | "pro";
  stripeReady: boolean;
  monthlyCents: number;
  yearlyCents: number;
  savedCents: number;
  savingsPercent: number;
  freeQuestions: number;
  freeAi: number;
  canceled: boolean;
}) {
  const [interval, setInterval] = useState<Interval>("year");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const yearlyPerMonth = Math.round(yearlyCents / 12);

  async function checkout() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const body = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!response.ok || !body?.url) {
        throw new Error(body?.error ?? "Could not start checkout");
      }
      window.location.href = body.url;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start checkout");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Upgrade to Pro</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Unlimited questions, and the trends that show where you&apos;re
          actually improving.
        </p>
      </div>

      {canceled ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Checkout was canceled. You can start it again whenever you want.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            interval === "month" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => setInterval("month")}
          aria-pressed={interval === "month"}
        >
          Monthly
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            interval === "year" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
          onClick={() => setInterval("year")}
          aria-pressed={interval === "year"}
        >
          Yearly · save {savingsPercent}%
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card px-4 py-4">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">
          {interval === "month" ? formatUsd(monthlyCents) : formatUsd(yearlyCents)}
          <span className="text-base font-medium text-muted-foreground">
            {interval === "month" ? " / month" : " / year"}
          </span>
        </p>
        {interval === "year" ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {formatUsd(yearlyPerMonth, 2)} a month, {formatUsd(savedCents)} less
            than paying monthly.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Or {formatUsd(yearlyCents)} a year and save {formatUsd(savedCents)}.
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="px-3 py-2 font-medium"> </th>
              <th className="px-3 py-2 font-medium">Free</th>
              <th className="px-3 py-2 font-medium">Pro</th>
            </tr>
          </thead>
          <tbody>
            <ComparisonRow
              label="Questions"
              free={`${freeQuestions} / day`}
              pro="Unlimited"
            />
            <ComparisonRow
              label="AI current events"
              free={`${freeAi} / day, when it ships`}
              pro="Unlimited"
            />
            <ComparisonRow
              label="Stats"
              free="Accuracy, streak, categories"
              pro="Trends, heatmap, timing"
            />
            <ComparisonRow
              label="Price"
              free="$0"
              pro={
                interval === "month"
                  ? `${formatUsd(monthlyCents)}/month`
                  : `${formatUsd(yearlyCents)}/year`
              }
            />
          </tbody>
        </table>
      </div>

      {plan === "pro" ? (
        <Button asChild className="h-11 px-4">
          <Link href="/account">You&apos;re on Pro · manage it</Link>
        </Button>
      ) : signedIn ? (
        <Button
          type="button"
          className="h-11 px-4"
          disabled={pending || !stripeReady}
          onClick={() => void checkout()}
        >
          {pending
            ? "Starting checkout…"
            : stripeReady
              ? `Continue with ${interval === "month" ? "monthly" : "yearly"}`
              : "Billing is not configured"}
        </Button>
      ) : (
        <Button asChild className="h-11 px-4">
          <Link href="/sign-in?redirect_url=/upgrade">Sign in to upgrade</Link>
        </Button>
      )}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ComparisonRow({
  label,
  free,
  pro,
}: {
  label: string;
  free: string;
  pro: string;
}) {
  return (
    <tr className="border-t border-border">
      <th className="px-3 py-3 text-left font-medium">{label}</th>
      <td className="px-3 py-3 text-muted-foreground">{free}</td>
      <td className="px-3 py-3">{pro}</td>
    </tr>
  );
}
