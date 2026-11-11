"use client";

import { useEffect } from "react";
import { browserTimeZone } from "@/lib/time/zone";

export function TimezoneSync() {
  useEffect(() => {
    const timeZone = browserTimeZone();
    if (!timeZone) return;
    const key = "tt-tz-synced";
    try {
      if (window.sessionStorage.getItem(key) === timeZone) return;
    } catch {
      // Private mode can block session storage. Still try the request once.
    }
    void fetch("/api/account/timezone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timeZone, source: "detect" }),
    }).then((response) => {
      if (!response.ok) return;
      try {
        window.sessionStorage.setItem(key, timeZone);
      } catch {
        // Ignore storage failures.
      }
    });
  }, []);
  return null;
}
