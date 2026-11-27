import posthog from "posthog-js";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

if (key && !posthog.__loaded) {
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: host.includes("eu.i.posthog.com")
      ? "https://eu.posthog.com"
      : "https://us.posthog.com",
    defaults: "2026-08-30",
    capture_pageview: "history_change",
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: true,
    },
  });
}
