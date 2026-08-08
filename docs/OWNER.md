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
3. In the app repo, create `.env.local`:

   ```bash
   VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="<anon/publishable key>"
   ```

   Both values come from Supabase **Settings → API**.
4. Rebuild/restart the app. Every user who signs up is now stored in your
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

