# TriviaTrainer

Next.js rebuild of TriviaTrainer with Clerk auth and Neon Postgres.

## Auth

Clerk application: `app_3LwlHmH4WqlR3b1FicYjDQdI3fh`

Required environment variables:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`

Copy `.env.example` to `.env.local` for local development. On Cursor Cloud Agents, inject the Clerk keys via **Cloud Agents → Secrets** so they are present at process start.

## Scripts

```bash
npm run dev
npm run build
npm run lint
```
