# Pocket Planner — Owner / Launch Guide

## Where data lives

| Mode | Database | Notes |
|------|----------|-------|
| Production | Supabase (PostgreSQL) | Cloud, shared across devices, survives browser clears. This is the real store for launch. |
| Development (no keys) | localStorage mock | Activated only when `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` are unset or placeholders. Data is per-browser and can be lost. The Settings page shows which mode you are in. |

Tables (all scoped to a household): `households`, `profiles`, `household_members`,
`categories`, `expenses`, `incomes`, `budgets`, `recurring_bills`, `savings_goals`.
Every table has Row Level Security so each user only ever reads/writes their own
household's rows. User accounts live in Supabase Auth.

## One-time setup

1. Create a free project at https://supabase.com.
2. In the project's **SQL Editor**, run `supabase/migrations/0001_init.sql`.
   This creates all tables, RLS policies, and a trigger that auto-provisions a
   profile, household, "self" member, and default categories when a user signs up.
3. **Then run `supabase/migrations/0002_launch_hardening.sql`** (also from the
   **SQL Editor**). This adds the security hardening from the pre-launch audit:
   - a guard so a user can never be moved into someone else's household,
   - protection so linked household members can't be deleted by accident,
   - rules that prevent duplicate budgets,
   - database-level sanity limits (amounts, dates, notes, currency) so bad data
     can never be written even if the app is bypassed.
   It is safe to run at any time — even if the first migration was already
   applied. It does not touch or delete any existing data.
4. In the app repo, create `.env.local`:

   ```bash
   VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="<anon/publishable key>"
   ```

   Both values come from Supabase **Settings → API**.
5. Rebuild/restart the app. Every user who signs up is now stored in your
   Supabase project.

## Viewing users and their emails

No code is needed — you are the app owner via the Supabase dashboard:

- **Supabase Dashboard → Authentication → Users** — live list of every account
  with email, creation time, and last sign-in.
- **Dashboard → Table Editor → `profiles`** — names, emails, currency, onboarding
  status, and each profile's household.
- For a richer summary, run this in the **SQL Editor**:

  ```sql
  select count(*) as total_users from auth.users;

  select p.id, p.full_name, p.email, p.currency, p.account_type, p.onboarded,
         h.name as household,
         (select count(*) from public.household_members m
           where m.household_id = p.household_id) as member_count
  from public.profiles p
  left join public.households h on h.id = p.household_id
  order by p.created_at desc;
  ```

Household data itself is private to each household by design (RLS), so the app
does not expose a public admin page — owner visibility lives in Supabase.

## Managing users as the owner

There is no "admin login" inside the app — you administer users through the
**Supabase dashboard** using the email you created the Supabase project with
(that email becomes the admin). Sign in at https://supabase.com and open your
project.

| Task | Where |
|------|-------|
| See every user's email, signup date, last sign-in | **Authentication → Users** |
| Block/suspend or delete an account | **Authentication → Users → user row → ⋯ menu** |
| Change a user's email address | **Authentication → Users → user → Edit → Email** |
| Send a user a password-reset email | **Authentication → Users → user → ⋯ → Send recovery** |
| View profiles, currency, onboarding status | **Table Editor → profiles** |
| Reply to support questions per user | **Table Editor → profiles** (`email`, `full_name`, `created_at`) |

### Passwords

Passwords are stored **hashed** by Supabase Auth — neither you nor anyone else
can ever view a user's plaintext password (this is deliberate; the app has no
backdoor). The safe ways to handle passwords:

- **User forgot password → they self-serve.** In the app's sign-in form they
  click **Forgot password?**, enter their email, and click the reset link they
  receive. This is the supported flow and requires no admin action.
- **Owner sends a reset** → dashboard **Send recovery** emails them the same
  link.
- **Owner forces a new password** (e.g. user lost access to their email) →
  only via the Supabase **Management API** `PUT /auth/v1/admin/users/{id}`
  with `{"password": "..."}` using your service_role/secret key. Prefer the
  recovery-email route; forcing a password is the last resort.

### App-side password reset (already implemented)

- Sign-in form has a **Forgot password?** link → user enters email →
  `resetPasswordForEmail(email)` sends a link pointing at `/reset-password`.
- `/reset-password` (new route) verifies the recovery session and shows a
  "Choose a new password" form, then updates the password and signs the user in.

### Important

- **Emails must be configured.** Reset links, sign-up confirmations, and
  "Send recovery" all rely on Supabase Auth sending email. Default Supabase
  email limits apply to new projects — enable a custom SMTP provider
  (Settings → Auth → SMTP) before launch so confirmations and resets arrive
  reliably.
- **Email confirmation** should be left ON (default) so accounts are only
  active after the user confirms their address.

## Launch checklist (what has already been done)

Everything below is implemented and verified (app builds cleanly). It is all
sitting locally **uncommitted** — nothing is pushed to the repository until the
owner confirms.

1. **Database hardening (migration `0002_launch_hardening.sql`)** — apply in
   Supabase before launch (see One-time setup, step 3).
2. **Accident-proof deletes** — every delete in the app (transactions,
   categories, bills, goals, household members, removing a budget) now asks
   "Are you sure?" before removing anything.
3. **Friendlier empty pages** — Bills, Goals, Household, Transactions and
   Budgets pages now explain what to do and offer a one-tap start button when
   there's no data yet.
4. **Friendly validation instead of raw errors** — amounts can't be negative or
   absurdly large, dates can't be in the future or before year 2000, notes and
   sources are length-capped, and the salary date must be 1–28. Users now see a
   clear message instead of a database error.

## Going live (deployment)

The app is a standard static frontend (Vite + React). Host it on any static
host (Netlify, Vercel, Cloudflare Pages):

1. **Build:** `npm run build` → outputs the `dist/` folder.
2. **Env vars:** set the same two variables as `.env.local` (from Supabase
   **Settings → API**) in the host's environment:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. **Routing:** SPA fallback is already configured — `public/_redirects` for
   Netlify and `vercel.json` for Vercel. No extra work needed.
4. Recommended host settings:
   - **Netlify:** Build command `npm run build`, publish directory `dist`.
   - **Vercel:** Framework preset "Vite", build `npm run build`, output `dist`.

### Before switching real users on

- [ ] Run both migrations (`0001`, then `0002`) in Supabase SQL Editor.
- [ ] Confirm the app talks to Supabase (Settings page shows "Supabase cloud").
- [ ] Enable custom SMTP in Supabase (Settings → Auth → SMTP) so reset and
      confirmation emails are reliable.
- [ ] Test one full sign-up on the live URL (confirm email → complete setup →
      add an expense → delete it → confirm the "Are you sure?" prompt appears).
- [ ] In Supabase **Authentication → Users**, confirm the new account appears.


