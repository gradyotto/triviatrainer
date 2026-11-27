# PostHog

Product analytics uses `posthog-js` in the browser and `posthog-node` on the server. Both read `NEXT_PUBLIC_POSTHOG_KEY`. `NEXT_PUBLIC_POSTHOG_HOST` defaults to `https://us.i.posthog.com`. If the key is unset, initialization and capture are no-ops.

Browser traffic goes through the Next.js rewrite at `/ingest` (`skipTrailingSlashRedirect` is on, and Clerk's matcher ignores that path). The server SDK talks to the host directly.

## Identity

Signed-in people are identified by their Clerk user id. Person properties are `username` and `plan`. Email is not sent. Signing out calls `posthog.reset()` so the next person on the browser does not inherit the profile.

## Pageviews and replay

`capture_pageview` is `history_change`, so the first load and App Router navigations both count. Session replay is enabled with `session_recording.maskAllInputs: true`.

## Feature flag

`homepage-daily-cta` changes the homepage button. The variant `beat-today` (or a boolean true) shows "Beat today's 20". Any other value, including a missing flag or a missing key, shows "Play today's challenge".

## Events

Server `track()` writes Postgres `conversion_events` and forwards the same call to PostHog. A few stored names are renamed so the product names stay stable:

| Stored event | PostHog event | Properties |
| --- | --- | --- |
| `signup` | `signed_up` | `source`, `plan` |
| `upgrade_page_viewed` | `upgrade_viewed` | |
| `checkout_started` | `checkout_started` | `interval` |
| `upgrade_completed` | `subscription_activated` | subscription status and interval |
| `review_session_started` | `review_session_started` | `dueCount` |
| `training_session_started` | `training_session_started` | `category` |
| `daily_challenge_started` | `daily_challenge_started` | `gameDate` |
| `daily_challenge_completed` | `daily_challenge_completed` | `score`, `correctCount`, `gameDate` |
| `bonus_answered` | `bonus_answered` | `correct`, `skipped` |
| `answer_disputed` | `answer_disputed` | `context`, `questionId` |

`daily_limit_hit` and `subscription_canceled` are forwarded under those same names. When `username` or `plan` is on the event, it is also copied onto the person with `$set`.
