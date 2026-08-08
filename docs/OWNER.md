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
