# ResumeTailor v2 (Vercel-ready)

This copy moves Gemini calls to backend API routes so your browser no longer stores API keys.

## What changed

- Server-side Gemini proxy:
  - `api/generate.js`
  - `api/rewrite-bullet.js`
- Trial and rate-limits:
  - `6` free full generations per user identity
  - `3` requests per `10` minutes for each endpoint action
- Trial status endpoint:
  - `api/trial-status.js`
- Frontend switched to `app.v2.js`.

## Environment variables

Required:

- `GEMINI_API_KEY`

Optional but recommended for production persistence:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

or

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

If Redis/KV vars are missing, limits fall back to in-memory counters (not durable across serverless instances).

## Deploy to Vercel

1. Import this folder as a project in Vercel.
2. Add environment variables from `.env.example`.
3. Deploy.

## Local run

You can run with Vercel CLI:

```bash
vercel dev
```

Then open the local URL shown by Vercel.
