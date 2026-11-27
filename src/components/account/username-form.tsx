"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function UsernameForm({
  current,
  heading = "Pick a username",
  body = "Leaderboards show this name. 3–20 characters: letters, numbers, and underscores.",
}: {
  current?: string | null;
  heading?: string;
  body?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/account/username", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: value }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        setError(payload?.error ?? "Could not save that username.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Could not save that username.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)}>
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">{heading}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <label className="text-sm font-medium" htmlFor="username">
        Username
      </label>
      <input
        id="username"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={20}
        className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-success-foreground" role="status">
          Username saved.
        </p>
      ) : null}
      <Button type="submit" className="h-11" disabled={saving || value.trim().length === 0}>
        {saving ? "Saving…" : current ? "Update username" : "Save username"}
      </Button>
    </form>
  );
}
