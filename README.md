# Pocket Planner

Privacy-focused personal and household budgeting built with React, TypeScript, Vite, and Supabase.

## Local development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

## Required production variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_ENABLE_DEMO_MODE=false`

Never commit service-role keys, database passwords, OAuth secrets, or `.env.local`.

## Quality checks

```bash
npm test
npm run build
npm run typecheck
```

## Deployment

Cloudflare Pages: build command `npm run build`, output directory `dist`, Node.js 22. Apply all SQL files in `supabase/migrations` in order. Configure the production URL in Supabase Authentication redirect settings.
