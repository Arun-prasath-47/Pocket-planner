create table if not exists public.feedback(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,household_id uuid references public.households(id) on delete cascade,category text not null default 'general' check(category in('general','bug','feature','privacy')),message text not null check(char_length(message) between 10 and 2000),status text not null default 'new' check(status in('new','reviewing','planned','resolved','closed')),created_at timestamptz not null default now());
create index if not exists feedback_user_id_idx on public.feedback(user_id);
create index if not exists feedback_household_id_idx on public.feedback(household_id);
create index if not exists feedback_created_at_idx on public.feedback(created_at desc);
alter table public.feedback enable row level security;
create policy feedback_insert_own on public.feedback for insert to authenticated with check(user_id=(select auth.uid()) and (household_id is null or household_id=(select private.get_my_household_id())));
create policy feedback_select_own on public.feedback for select to authenticated using(user_id=(select auth.uid()));
