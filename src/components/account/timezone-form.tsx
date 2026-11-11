"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function TimezoneForm({ timeZone }: { timeZone: string }) {
  const [value, setValue] = useState(timeZone);
  const [saved, setSaved] = useState(timeZone);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const zones =
    typeof Intl !== "undefined" && "supportedValuesOf" in Intl
      ? Intl.supportedValuesOf("timeZone")
      : [timeZone];

  async function save() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/account/timezone", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ timeZone: value, source: "manual" }),
      });
      const body = (await response.json().catch(() => null)) as
        | { timeZone?: string; error?: string }
        | null;
      if (!response.ok || !body?.timeZone) {
        throw new Error(body?.error ?? "Could not save time zone");
      }
      setSaved(body.timeZone);
      setValue(body.timeZone);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save time zone");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium" htmlFor="time-zone">
        Time zone
      </label>
      <p className="text-sm text-muted-foreground">
        Daily limits and your day streak reset at midnight here.
      </p>
      <input
        id="time-zone"
        list="time-zones"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <datalist id="time-zones">
        {zones.map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-fit px-4"
        disabled={pending || value.trim() === saved}
        onClick={() => void save()}
      >
        {pending ? "Saving…" : "Save time zone"}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
