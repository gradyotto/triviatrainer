# PostHog

Product analytics uses `posthog-js` in the browser and `posthog-node` on the server. Both read `NEXT_PUBLIC_POSTHOG_KEY`. `NEXT_PUBLIC_POSTHOG_HOST` defaults to `https://us.i.posthog.com`. If the key is unset, initialization and capture are no-ops.

Browser traffic goes through the Next.js rewrite at `/ingest` (`skipTrailingSlashRedirect` is on, and Clerk's matcher ignores that path). The server SDK talks to the host directly.

## Identity

Signed-in people are identified by their Clerk user id. The browser calls `posthog.identify(clerkUserId, { username, plan })` once Clerk reports a signed-in user, and `posthog.reset()` on sign-out. Email is never sent.

Server events use that same Clerk user id as `distinct_id` whenever `auth()` has one. Guests do not get a second anonymous id: the browser writes its PostHog distinct id into the `tt_ph_distinct` cookie and sends `x-posthog-distinct-id` on API calls, and the server uses that id. When a guest later claims a score, the server aliases the previous browser id (and the legacy guest cookie, for events captured before this) to the Clerk user id. The client `identify` merges the same browser history.

Person properties are `username` and `plan`. Server captures copy them onto the person with `$set`, filling them from the user row when the event did not already include them.

## Pageviews and replay

`capture_pageview` is `history_change`, so the first load and App Router navigations both count. Session replay is enabled with `session_recording.maskAllInputs: true`.

## Feature flag

`homepage-daily-cta` changes the homepage button. The variant `beat-today` (or a boolean true) shows "Beat today's 10". Any other value, including a missing flag or a missing key, shows "Play today's challenge".

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
| `answer_disputed` | `answer_disputed` | `userAnswer`, `correctAnswer`, `mode`, `questionId` |

`daily_limit_hit` and `subscription_canceled` are forwarded under those same names. When `username` or `plan` is on the event, it is also copied onto the person with `$set`. The dispute row stores the typed answer in `response` and the expected answer in `expected_answer`.
