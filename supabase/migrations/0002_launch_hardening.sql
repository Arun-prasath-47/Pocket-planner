-- ===========================================================================
-- 0002: LAUNCH HARDENING (database defense-in-depth)
-- Safe to run any time, even if 0001_init.sql has already been applied.
-- Every statement is idempotent. Paste the whole file into the SQL Editor.
-- ===========================================================================

-- 1. profiles: prevent a user from moving their profile into someone else's
--    household on update (C2). Only allow NULL, their current household, or a
--    household they own.
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and (
      household_id is null
      or household_id = public.get_my_household_id()
      or exists (
        select 1 from public.households h
        where h.id = household_id and h.owner_id = auth.uid()
      )
    )
  );

-- 2. household_members: only placeholder members (no linked user account) may
--    be deleted. Linked members are the owners/co-owners themselves.
drop policy if exists "members_delete" on public.household_members;
create policy "members_delete" on public.household_members
  for delete using (household_id = public.get_my_household_id() and user_id is null);

-- 3. budgets: at most one budget per category per household, and at most one
--    overall budget per household.
create unique index if not exists budgets_one_per_category
  on public.budgets (household_id, category_id) where category_id is not null;
create unique index if not exists budgets_one_overall
  on public.budgets (household_id) where category_id is null;

-- 4. Data integrity: sanity limits enforced by the database itself, so bad
--    data can never be written even if the app is bypassed.
alter table public.profiles add constraint if not exists profiles_currency_valid
  check (currency in ('INR','USD','EUR','GBP','AUD','CAD','AED','SGD'));

alter table public.expenses add constraint if not exists expenses_amount_sane
  check (amount < 1000000000);
alter table public.expenses add constraint if not exists expenses_note_len
  check (char_length(note) <= 200);
alter table public.expenses add constraint if not exists expenses_date_sane
  check (occurred_on between '2000-01-01' and current_date + interval '1 day');

alter table public.incomes add constraint if not exists incomes_amount_sane
  check (amount < 1000000000);
alter table public.incomes add constraint if not exists incomes_note_len
  check (char_length(note) <= 200);
alter table public.incomes add constraint if not exists incomes_date_sane
  check (occurred_on between '2000-01-01' and current_date + interval '1 day');

alter table public.budgets add constraint if not exists budgets_amount_sane
  check (amount < 1000000000);

alter table public.recurring_bills add constraint if not exists bills_amount_sane
  check (amount < 1000000000);

alter table public.savings_goals add constraint if not exists goals_target_sane
  check (target_amount < 1000000000);
alter table public.savings_goals add constraint if not exists goals_saved_sane
  check (saved_amount < 1000000000);
