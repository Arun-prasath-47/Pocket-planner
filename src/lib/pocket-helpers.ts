import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type DB = SupabaseClient<Database>;

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export async function getProfile(supabase: DB, userId: string): Promise<Profile> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;

  // Auto-create initial household & profile if missing
  const { data: userResp } = await supabase.auth.getUser();
  const email = userResp.user?.email ?? "";
  const name = userResp.user?.user_metadata?.full_name || email.split("@")[0] || "User";

  const { data: hh, error: hhErr } = await supabase
    .from("households")
    .insert({ name: `${name}'s Household`, owner_id: userId })
    .select()
    .single();
  if (hhErr) throw new Error(hhErr.message);

  const newProfile = {
    id: userId,
    full_name: name,
    account_type: "household" as const,
    currency: "INR",
    cycle_start_day: 1,
    household_id: hh.id,
    onboarded: true,
  };
  const { data: created, error: createErr } = await supabase
    .from("profiles")
    .insert(newProfile)
    .select()
    .single();
  if (createErr) throw new Error(createErr.message);

  await supabase.from("household_members").insert({
    household_id: hh.id,
    user_id: userId,
    name,
    relation: "self",
    is_income_contributor: true,
    color: "chart-1",
  });

  const defaultCategories = [
    { name: "Groceries & Food", is_essential: true, icon: "ShoppingBag", sort_order: 1 },
    { name: "Rent & Utilities", is_essential: true, icon: "Home", sort_order: 2 },
    { name: "Transport & Fuel", is_essential: true, icon: "Car", sort_order: 3 },
    { name: "Healthcare & Meds", is_essential: true, icon: "Activity", sort_order: 4 },
    { name: "Dining & Outing", is_essential: false, icon: "Utensils", sort_order: 5 },
    { name: "Shopping & Clothes", is_essential: false, icon: "ShoppingBag", sort_order: 6 },
    { name: "Bills & Subscriptions", is_essential: true, icon: "Receipt", sort_order: 7 },
    { name: "Entertainment & Fun", is_essential: false, icon: "Film", sort_order: 8 },
  ];
  await supabase.from("categories").insert(
    defaultCategories.map((c) => ({
      household_id: hh.id,
      ...c,
    })),
  );

  return created;
}

export async function requireHousehold(supabase: DB, userId: string) {
  const profile = await getProfile(supabase, userId);
  if (!profile.household_id) throw new Error("No household linked to this account");
  return { profile, householdId: profile.household_id };
}

export function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function sum<T>(rows: T[], pick: (row: T) => unknown) {
  return rows.reduce((total, row) => total + num(pick(row)), 0);
}
