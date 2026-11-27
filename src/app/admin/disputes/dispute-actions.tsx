"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DisputeActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "accept" | "reject") {
    setBusy(action);
    setError(null);
    try {
      const response = await fetch("/api/admin/disputes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!response.ok) {
        setError("Could not update that dispute.");
        setBusy(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not update that dispute.");
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy !== null}
          onClick={() => void act("accept")}
        >
          {busy === "accept" ? "Accepting…" : "Accept"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => void act("reject")}
        >
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
