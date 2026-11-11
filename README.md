# TriviaTrainer

Mobile-first trivia training for bar trivia and Jeopardy-minded players. Phase 1 is the core train loop: pick a category or a mixed set, answer multiple-choice and fill-in questions one at a time, and see the correct answer immediately.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and choose **Start training**. No database or Clerk keys are required. Without `DATABASE_URL`, questions come from `data/seed-questions.json` and attempts are not stored. Without Clerk keys, the app still renders and guests can train. Keys only turn auth on when the publishable key starts with `pk_test_` or `pk_live_` and the secret starts with `sk_test_` or `sk_live_`. Anything else leaves guest mode on, so a bad value cannot crash the site.

## Save progress

Copy `.env.example` to `.env.local` and set:

- `DATABASE_URL` — Neon pooled connection string for project `curly-glitter-40844837`
- `DATABASE_URL_UNPOOLED` — Neon direct connection. `npm run db:migrate` uses this when it is set.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` — Clerk app `app_3LwlHmH4WqlR3b1FicYjDQdI3fh`

Then:

```bash
npm run db:migrate
npm run db:seed
```

Signed-in answers are written to `session_answers` and rolled up on `question_progress`. Spaced-repetition columns (`ease_factor`, `interval_days`, `repetition`, `lapses`, `next_review_at`) are reserved and left at their defaults.

## Deploying / Vercel previews

Vercel preview deployments (the `*.vercel.app` URL created for each push) need these four environment variables on the project, scoped to Preview. Set the names in the Vercel dashboard; do not commit values.

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL` — pooled Neon URL the app uses at runtime
- `DATABASE_URL_UNPOOLED` — direct Neon URL, used when a preview runs migrations

Clerk development keys (`pk_test_` / `sk_test_`) work on `vercel.app` preview domains. A custom production domain is what needs production keys.

## Checks

```bash
npm test
npm run lint
npm run build
```

Grading: multiple choice is an exact option match. Fill-in ignores case, punctuation, and articles (`a`, `an`, `the`), and allows a small edit distance on longer answers.
