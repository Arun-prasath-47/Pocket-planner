-- ============================================================================
-- Pocket Planner — Supabase schema & security (PostgreSQL)
-- Run this in the Supabase SQL Editor, or via `supabase db push`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
create type public.account_type as enum ('individual', 'household');
create type public.income_frequency as enum ('monthly', 'weekly', 'biweekly', 'irregular');
create type public.member_relation as enum ('self', 'father', 'mother', 'son', 'daughter', 'spouse', 'other');

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Household',
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  account_type public.account_type not null default 'household',
  currency text not null default 'INR',
  cycle_start_day int not null default 1 check (cycle_start_day between 1 and 28),
  household_id uuid references public.households (id) on delete set null,
  onboarded boolean not null default false,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  relation public.member_relation not null default 'other',
  is_income_contributor boolean not null default false,
  color text not null default 'chart-1',
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  is_essential boolean not null default true,
  icon text not null default 'Tag',
  sort_order int not null default 99,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  amount numeric not null check (amount >= 0),
  category_id uuid references public.categories (id) on delete set null,
  occurred_on date not null,
  note text,
  payment_type text not null default 'cash',
  spender_id uuid references public.household_members (id) on delete set null,
  beneficiary_id uuid references public.household_members (id) on delete set null,
  is_shared boolean not null default true,
  is_essential boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  amount numeric not null check (amount >= 0),
  occurred_on date not null,
  source text not null default 'Salary',
  frequency public.income_frequency not null default 'monthly',
  member_id uuid references public.household_members (id) on delete set null,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  category_id uuid references public.categories (id) on delete cascade,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  amount numeric not null check (amount >= 0),
  due_day int not null default 1 check (due_day between 1 and 31),
  category_id uuid references public.categories (id) on delete set null,
  is_active boolean not null default true,
  last_paid_on date,
  created_at timestamptz not null default now()
);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  target_amount numeric not null check (target_amount >= 0),
  saved_amount numeric not null default 0 check (saved_amount >= 0),
  target_date date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
create index households_owner_id_idx on public.households (owner_id);
create index profiles_household_id_idx on public.profiles (household_id);
create index members_household_id_idx on public.household_members (household_id);
create index categories_household_id_idx on public.categories (household_id);
create index expenses_household_id_idx on public.expenses (household_id);
create index expenses_occurred_on_idx on public.expenses (occurred_on);
create index expenses_category_id_idx on public.expenses (category_id);
create index incomes_household_id_idx on public.incomes (household_id);
create index incomes_occurred_on_idx on public.incomes (occurred_on);
create index budgets_household_id_idx on public.budgets (household_id);
create index bills_household_id_idx on public.recurring_bills (household_id);
create index goals_household_id_idx on public.savings_goals (household_id);

create unique index budgets_one_per_category on public.budgets (household_id, category_id) where category_id is not null;
create unique index budgets_one_overall on public.budgets (household_id) where category_id is null;

-- ---------------------------------------------------------------------------
-- HELPER: the household id of the current user
-- ---------------------------------------------------------------------------
create or replace function public.get_my_household_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select household_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Every user only ever sees the household they belong to.
-- ---------------------------------------------------------------------------
alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.incomes enable row level security;
alter table public.budgets enable row level security;
alter table public.recurring_bills enable row level security;
alter table public.savings_goals enable row level security;

-- households ---------------------------------------------------------------
drop policy if exists "households_select" on public.households;
create policy "households_select" on public.households
  for select using (owner_id = auth.uid() or id = public.get_my_household_id());

drop policy if exists "households_insert" on public.households;
create policy "households_insert" on public.households
  for insert with check (owner_id = auth.uid());

drop policy if exists "households_update" on public.households;
create policy "households_update" on public.households
  for update using (owner_id = auth.uid());

-- profiles -----------------------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
  for insert with check (id = auth.uid());

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

-- household_members --------------------------------------------------------
drop policy if exists "members_select" on public.household_members;
create policy "members_select" on public.household_members
  for select using (household_id = public.get_my_household_id());

drop policy if exists "members_insert" on public.household_members;
create policy "members_insert" on public.household_members
  for insert with check (household_id = public.get_my_household_id());

drop policy if exists "members_update" on public.household_members;
create policy "members_update" on public.household_members
  for update using (household_id = public.get_my_household_id());

drop policy if exists "members_delete" on public.household_members;
create policy "members_delete" on public.household_members
  for delete using (household_id = public.get_my_household_id() and user_id is null);

-- categories ---------------------------------------------------------------
drop policy if exists "categories_all" on public.categories;
create policy "categories_all" on public.categories
  for all using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- expenses -----------------------------------------------------------------
drop policy if exists "expenses_all" on public.expenses;
create policy "expenses_all" on public.expenses
  for all using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- incomes ------------------------------------------------------------------
drop policy if exists "incomes_all" on public.incomes;
create policy "incomes_all" on public.incomes
  for all using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- budgets ------------------------------------------------------------------
drop policy if exists "budgets_all" on public.budgets;
create policy "budgets_all" on public.budgets
  for all using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- recurring_bills ----------------------------------------------------------
drop policy if exists "bills_all" on public.recurring_bills;
create policy "bills_all" on public.recurring_bills
  for all using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- savings_goals ------------------------------------------------------------
drop policy if exists "goals_all" on public.savings_goals;
create policy "goals_all" on public.savings_goals
  for all using (household_id = public.get_my_household_id())
  with check (household_id = public.get_my_household_id());

-- ---------------------------------------------------------------------------
-- DATA INTEGRITY & VALIDATION (server-side defense in depth)
-- Client forms already cap these; the database enforces them regardless.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- AUTO-PROVISION A NEW USER'S PROFILE + HOUSEHOLD ON SIGN-UP
-- Mirrors what the app's client would otherwise create, server-side.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
  v_household_id uuid;
begin
  v_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'User');

  insert into public.households (name, owner_id)
  values (v_name || '''s Household', new.id)
  returning id into v_household_id;

  insert into public.profiles (id, full_name, account_type, currency, cycle_start_day, household_id, onboarded, email)
  values (new.id, v_name, 'household', 'INR', 1, v_household_id, false, new.email);

  insert into public.household_members (household_id, name, relation, is_income_contributor, color, user_id)
  values (v_household_id, v_name, 'self', true, 'chart-1', new.id);

  insert into public.categories (household_id, name, is_essential, icon, sort_order) values
    (v_household_id, 'Groceries & Food',      true,  'ShoppingBag', 1),
    (v_household_id, 'Rent & Utilities',      true,  'Home',        2),
    (v_household_id, 'Transport & Fuel',      true,  'Car',         3),
    (v_household_id, 'Healthcare & Meds',     true,  'Activity',    4),
    (v_household_id, 'Dining & Outing',       false, 'Utensils',    5),
    (v_household_id, 'Shopping & Clothes',    false, 'ShoppingBag', 6),
    (v_household_id, 'Bills & Subscriptions', true,  'Receipt',     7),
    (v_household_id, 'Entertainment & Fun',   false, 'Film',        8);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- OWNER / ADMIN QUERIES (run in Supabase SQL Editor, not in the app):
--
-- How many users / their emails:
--   select count(*) as total_users from auth.users;
--   select email, created_at, last_sign_in_at from auth.users order by created_at desc;
--
-- Per-user summary with household + member count:
--   select p.id, p.full_name, p.email, p.currency, p.account_type, p.onboarded,
--          h.name as household,
--          (select count(*) from public.household_members m
--            where m.household_id = p.household_id) as member_count
--   from public.profiles p
--   left join public.households h on h.id = p.household_id
--   order by p.created_at desc;
--
-- See authentication/activity in the Dashboard UI: Authentication -> Users.
-- ============================================================================
