create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create or replace function private.get_my_household_id() returns uuid language sql stable security definer set search_path=public as $$ select household_id from public.profiles where id=(select auth.uid()); $$;
revoke all on function private.get_my_household_id() from public, anon;
grant execute on function private.get_my_household_id() to authenticated;

do $$ declare r record; begin
  for r in select schemaname, tablename, policyname, cmd, qual, with_check from pg_policies where schemaname='public' and (qual like '%get_my_household_id%' or with_check like '%get_my_household_id%') loop
    execute format('drop policy %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  end loop;
end $$;

create policy households_select on public.households for select using(owner_id=(select auth.uid()) or id=(select private.get_my_household_id()));
create policy profiles_update on public.profiles for update using(id=(select auth.uid())) with check(id=(select auth.uid()) and (household_id is null or household_id=(select private.get_my_household_id()) or exists(select 1 from public.households h where h.id=household_id and h.owner_id=(select auth.uid()))));
create policy members_select on public.household_members for select using(household_id=(select private.get_my_household_id()));
create policy members_insert on public.household_members for insert with check(household_id=(select private.get_my_household_id()));
create policy members_update on public.household_members for update using(household_id=(select private.get_my_household_id())) with check(household_id=(select private.get_my_household_id()));
create policy members_delete on public.household_members for delete using(household_id=(select private.get_my_household_id()) and user_id is null);
create policy categories_all on public.categories for all using(household_id=(select private.get_my_household_id())) with check(household_id=(select private.get_my_household_id()));
create policy expenses_all on public.expenses for all using(household_id=(select private.get_my_household_id())) with check(household_id=(select private.get_my_household_id()));
create policy incomes_all on public.incomes for all using(household_id=(select private.get_my_household_id())) with check(household_id=(select private.get_my_household_id()));
create policy budgets_all on public.budgets for all using(household_id=(select private.get_my_household_id())) with check(household_id=(select private.get_my_household_id()));
create policy bills_all on public.recurring_bills for all using(household_id=(select private.get_my_household_id())) with check(household_id=(select private.get_my_household_id()));
create policy goals_all on public.savings_goals for all using(household_id=(select private.get_my_household_id())) with check(household_id=(select private.get_my_household_id()));
revoke all on function public.handle_new_user() from public,anon,authenticated;
drop function if exists public.get_my_household_id();
create index if not exists household_members_user_id_idx on public.household_members(user_id);
create index if not exists expenses_beneficiary_id_idx on public.expenses(beneficiary_id);
create index if not exists expenses_created_by_idx on public.expenses(created_by);
create index if not exists expenses_spender_id_idx on public.expenses(spender_id);
create index if not exists incomes_created_by_idx on public.incomes(created_by);
create index if not exists incomes_member_id_idx on public.incomes(member_id);
create index if not exists recurring_bills_category_id_idx on public.recurring_bills(category_id);
