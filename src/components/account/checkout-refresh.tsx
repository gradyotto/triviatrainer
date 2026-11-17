"use client";

import { useEffect, useRef } from "react";

export function CheckoutRefresh({ pending }: { pending: boolean }) {
  const started = useRef(false);

  useEffect(() => {
    if (!pending) {
      try {
        window.sessionStorage.removeItem("tt-checkout-refresh");
      } catch {
        // Ignore storage failures.
      }
      return;
    }
    if (started.current) return;
    started.current = true;
    const key = "tt-checkout-refresh";
    let count = 0;
    try {
      count = Number(window.sessionStorage.getItem(key) ?? "0");
    } catch {
      count = 0;
    }
    if (!Number.isFinite(count) || count >= 5) return;
    try {
      window.sessionStorage.setItem(key, String(count + 1));
    } catch {
      // Reloading still helps if storage is blocked.
    }
    const timer = window.setTimeout(() => window.location.reload(), 1500);
    return () => window.clearTimeout(timer);
  }, [pending]);

  return null;
}
