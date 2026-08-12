import { supabase } from "@/integrations/supabase/client";
import { getProfile, requireHousehold, num, sum, type DB } from "@/lib/pocket-helpers";
import { getCycle, toDateKey } from "@/lib/finance";
import { addDays } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];
type IncomeRow = Database["public"]["Tables"]["incomes"]["Row"];

const MAX_AMOUNT = 1000000000;
const MIN_DATE = "2000-01-01";
const MAX_NOTE_LEN = 200;

function assertAmount(value: number, label = "Amount") {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a number`);
  if (value < 0) throw new Error(`${label} cannot be negative`);
  if (value >= MAX_AMOUNT)
    throw new Error(`${label} is too large — keep it below 1,000,000,000`);
}

function assertDate(value: string) {
  if (!value) throw new Error("Date is required");
  if (value < MIN_DATE) throw new Error("Date cannot be earlier than 1 Jan 2000");
  const maxDate = toDateKey(addDays(new Date(), 1));
  if (value > maxDate) throw new Error("Date cannot be in the future");
}

function assertNote(value: string | null | undefined) {
  if ((value ?? "").length > MAX_NOTE_LEN)
    throw new Error(`Note is too long — keep it under ${MAX_NOTE_LEN} characters`);
}

function assertCycleDay(day: number) {
  if (!Number.isInteger(day) || day < 1 || day > 28)
    throw new Error("Salary date must be a whole number between 1 and 28");
}

async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Unauthorized");
  return data.user.id;
}

export async function getBootstrap() {
  const userId = await getUserId();
  const profile = await getProfile(supabase, userId);
  if (!profile.household_id) {
    return { profile, household: null, members: [], categories: [] };
  }
  const [household, members] = await Promise.all([
    supabase.from("households").select("*").eq("id", profile.household_id).maybeSingle(),
    supabase
      .from("household_members")
      .select("*")
      .eq("household_id", profile.household_id)
      .order("created_at"),
  ]);

  await ensureExtraCategories(supabase, profile.household_id);
  const categories = await getCategoriesRaw(supabase, profile.household_id);

  return {
    profile,
    household: household.data,
    members: members.data ?? [],
    categories,
  };
}

const EXTRA_CATEGORIES: Array<{ name: string; is_essential: boolean; icon: string }> = [
  { name: "Lending", is_essential: false, icon: "Handshake" },
  { name: "Others", is_essential: false, icon: "Ellipsis" },
];

async function getCategoriesRaw(supabase: DB, householdId: string) {
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("household_id", householdId)
    .order("sort_order");
  return data ?? [];
}

export async function ensureExtraCategories(supabase: DB, householdId: string) {
  const { data: existing } = await supabase
    .from("categories")
    .select("name")
    .eq("household_id", householdId);
  const names = new Set((existing ?? []).map((c: { name: string }) => c.name.toLowerCase()));
  const missing = EXTRA_CATEGORIES.filter((c) => !names.has(c.name.toLowerCase()));
  if (missing.length === 0) return;
  const { error } = await supabase.from("categories").insert(
    missing.map((c, i) => ({
      household_id: householdId,
      ...c,
      sort_order: 90 + i,
    })),
  );
  if (error) console.warn("ensureExtraCategories:", error);
}

export async function completeOnboarding({
  data,
}: {
  data: {
    fullName: string;
    accountType: "individual" | "household";
    householdName: string;
    currency: string;
    cycleStartDay: number;
    members: Array<{
      name: string;
      relation: "self" | "father" | "mother" | "son" | "daughter" | "spouse" | "other";
      isIncomeContributor: boolean;
    }>;
  };
}) {
  const userId = await getUserId();
  const { householdId } = await requireHousehold(supabase, userId);
  if (!data.fullName.trim()) throw new Error("Please enter your name");
  assertCycleDay(data.cycleStartDay);

  await supabase
    .from("profiles")
    .update({
      full_name: data.fullName,
      account_type: data.accountType,
      currency: data.currency,
      cycle_start_day: data.cycleStartDay,
      onboarded: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  await supabase.from("households").update({ name: data.householdName }).eq("id", householdId);
  await supabase
    .from("household_members")
    .update({ name: data.fullName })
    .eq("household_id", householdId)
    .eq("user_id", userId);

  if (data.accountType === "household" && data.members.length) {
    const palette = ["chart-2", "chart-3", "chart-4", "chart-5", "chart-1"];
    await supabase.from("household_members").insert(
      data.members.map((m, i) => ({
        household_id: householdId,
        name: m.name,
        relation: m.relation,
        is_income_contributor: m.isIncomeContributor,
        color: palette[i % palette.length]!,
      })),
    );
  }
  return { ok: true };
}

export async function updateSettings({
  data,
}: {
  data: {
    fullName: string;
    householdName: string;
    accountType: "individual" | "household";
    currency: string;
    cycleStartDay: number;
  };
}) {
  const userId = await getUserId();
  const { householdId } = await requireHousehold(supabase, userId);
  assertCycleDay(data.cycleStartDay);
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: data.fullName,
      account_type: data.accountType,
      currency: data.currency,
      cycle_start_day: data.cycleStartDay,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  await supabase.from("households").update({ name: data.householdName }).eq("id", householdId);
  return { ok: true };
}

export async function saveMember({
  data,
}: {
  data: {
    id?: string | undefined;
    name: string;
    relation: "self" | "father" | "mother" | "son" | "daughter" | "spouse" | "other";
    isIncomeContributor: boolean;
    color: string;
  };
}) {
  const userId = await getUserId();
  const { householdId } = await requireHousehold(supabase, userId);
  const row = {
    household_id: householdId,
    name: data.name,
    relation: data.relation,
    is_income_contributor: data.isIncomeContributor,
    color: data.color || "chart-1",
  };
  const query = data.id
    ? supabase.from("household_members").update(row).eq("id", data.id)
    : supabase.from("household_members").insert(row);
  const { error } = await query;
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteMember({ data }: { data: { id: string } }) {
  const userId = await getUserId();
  await requireHousehold(supabase, userId);
  const { error } = await supabase
    .from("household_members")
    .delete()
    .eq("id", data.id)
    .is("user_id", null);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function saveCategory({
  data,
}: {
  data: {
    id?: string | undefined;
    name: string;
    isEssential: boolean;
    icon?: string | undefined;
  };
}) {
  const userId = await getUserId();
  const { householdId } = await requireHousehold(supabase, userId);
  const row = {
    household_id: householdId,
    name: data.name,
    is_essential: data.isEssential,
    icon: data.icon || "Tag",
  };
  const { error } = data.id
    ? await supabase.from("categories").update(row).eq("id", data.id)
    : await supabase.from("categories").insert({ ...row, sort_order: 99 });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteCategory({ data }: { data: { id: string } }) {
  const userId = await getUserId();
  await requireHousehold(supabase, userId);
  const { error } = await supabase.from("categories").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function listTransactions({
  data = {},
}: {
  data?: {
    from?: string | undefined;
    to?: string | undefined;
    categoryId?: string | undefined;
    memberId?: string | undefined;
    kind?: "all" | "expense" | "income" | undefined;
    tag?: "all" | "shared" | "personal" | "essential" | "non-essential" | undefined;
    search?: string | undefined;
  };
}) {
  const userId = await getUserId();
  const { householdId } = await requireHousehold(supabase, userId);

  let expenses: ExpenseRow[] = [];
  let incomes: IncomeRow[] = [];

  if (data.kind !== "income") {
    let q = supabase
      .from("expenses")
      .select("*")
      .eq("household_id", householdId)
      .order("occurred_on", { ascending: false })
      .limit(500);
    if (data.from) q = q.gte("occurred_on", data.from);
    if (data.to) q = q.lte("occurred_on", data.to);
    if (data.categoryId && data.categoryId !== "all") q = q.eq("category_id", data.categoryId);
    if (data.memberId && data.memberId !== "all") q = q.eq("spender_id", data.memberId);
    if (data.tag === "shared") q = q.eq("is_shared", true);
    if (data.tag === "personal") q = q.eq("is_shared", false);
    if (data.tag === "essential") q = q.eq("is_essential", true);
    if (data.tag === "non-essential") q = q.eq("is_essential", false);
    if (data.search) q = q.ilike("note", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    expenses = rows ?? [];
  }

  if (data.kind !== "expense") {
    let q = supabase
      .from("incomes")
      .select("*")
      .eq("household_id", householdId)
      .order("occurred_on", { ascending: false })
      .limit(500);
    if (data.from) q = q.gte("occurred_on", data.from);
    if (data.to) q = q.lte("occurred_on", data.to);
    if (data.memberId && data.memberId !== "all") q = q.eq("member_id", data.memberId);
    if (data.search) q = q.ilike("source", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    incomes = rows ?? [];
  }

  return { expenses, incomes };
}

export async function saveExpense({
  data,
}: {
  data: {
    id?: string | undefined;
    amount: number;
    categoryId: string | null;
    occurredOn: string;
    note?: string | undefined;
    paymentType: string;
    spenderId: string | null;
    beneficiaryId: string | null;
    isShared: boolean;
    isEssential: boolean;
  };
}) {
  const userId = await getUserId();
  const { householdId } = await requireHousehold(supabase, userId);
  assertAmount(data.amount);
  assertDate(data.occurredOn);
  assertNote(data.note);
  const row = {
    household_id: householdId,
    amount: data.amount,
    category_id: data.categoryId,
    occurred_on: data.occurredOn,
    note: data.note ?? null,
    payment_type: data.paymentType || "cash",
    spender_id: data.spenderId,
    beneficiary_id: data.beneficiaryId,
    is_shared: data.isShared,
    is_essential: data.isEssential,
    created_by: userId,
  };
  const { error } = data.id
    ? await supabase.from("expenses").update(row).eq("id", data.id)
    : await supabase.from("expenses").insert(row);
  if (error) throw new Error(error.message);

  const profile = await getProfile(supabase, userId);
  const cycle = getCycle(profile.cycle_start_day, new Date());
  const [{ data: budgets }, { data: spentRows }] = await Promise.all([
    supabase.from("budgets").select("*").eq("household_id", householdId),
    supabase
      .from("expenses")
      .select("amount, category_id")
      .eq("household_id", householdId)
      .gte("occurred_on", toDateKey(cycle.start))
      .lte("occurred_on", toDateKey(cycle.end)),
  ]);
  const rows = spentRows ?? [];
  const totalSpent = sum(rows, (r) => r.amount);
  const catSpent = sum(
    rows.filter((r) => r.category_id === data.categoryId),
    (r) => r.amount,
  );
  const overall = (budgets ?? []).find((b) => b.category_id === null);
  const catBudget = (budgets ?? []).find((b) => b.category_id === data.categoryId);
  return {
    ok: true,
    overallBudget: overall ? num(overall.amount) : 0,
    overallSpent: totalSpent,
    categoryBudget: catBudget ? num(catBudget.amount) : 0,
    categorySpent: catSpent,
  };
}

export async function saveIncome({
  data,
}: {
  data: {
    id?: string | undefined;
    amount: number;
    occurredOn: string;
    source: string;
    frequency: "monthly" | "weekly" | "biweekly" | "irregular";
    memberId: string | null;
    note?: string | undefined;
  };
}) {
  const userId = await getUserId();
  const { householdId } = await requireHousehold(supabase, userId);
  assertAmount(data.amount);
  assertDate(data.occurredOn);
  assertNote(data.note);
  if ((data.source ?? "").length > 60) throw new Error("Source is too long — keep it under 60 characters");
  const row = {
    household_id: householdId,
    amount: data.amount,
    occurred_on: data.occurredOn,
    source: data.source,
    frequency: data.frequency,
    member_id: data.memberId,
    note: data.note ?? null,
    created_by: userId,
  };
  const { error } = data.id
    ? await supabase.from("incomes").update(row).eq("id", data.id)
    : await supabase.from("incomes").insert(row);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteTransaction({
  data,
}: {
  data: { id: string; kind: "expense" | "income" };
}) {
  const userId = await getUserId();
  await requireHousehold(supabase, userId);
  const { error } = await supabase
    .from(data.kind === "expense" ? "expenses" : "incomes")
    .delete()
    .eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getBudgets() {
  const userId = await getUserId();
  const { householdId, profile } = await requireHousehold(supabase, userId);
  const cycle = getCycle(profile.cycle_start_day, new Date());
  const [{ data: budgets }, { data: expenses }, { data: categories }] = await Promise.all([
    supabase.from("budgets").select("*").eq("household_id", householdId),
    supabase
      .from("expenses")
      .select("amount, category_id")
      .eq("household_id", householdId)
      .gte("occurred_on", toDateKey(cycle.start))
      .lte("occurred_on", toDateKey(cycle.end)),
    supabase
      .from("categories")
      .select("*")
      .eq("household_id", householdId)
      .order("sort_order"),
  ]);
  const rows = expenses ?? [];
  return {
    cycleLabel: cycle.label,
    overall: {
      limit: num((budgets ?? []).find((b) => b.category_id === null)?.amount),
      spent: sum(rows, (r) => r.amount),
    },
    categories: (categories ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      isEssential: c.is_essential,
      limit: num((budgets ?? []).find((b) => b.category_id === c.id)?.amount),
      spent: sum(
        rows.filter((r) => r.category_id === c.id),
        (r) => r.amount,
      ),
    })),
  };
}

export async function saveBudget({
  data,
}: {
  data: { categoryId: string | null; amount: number };
}) {
  const userId = await getUserId();
  const { householdId } = await requireHousehold(supabase, userId);
  if (data.amount > 0) assertAmount(data.amount);
  let existing = supabase.from("budgets").select("id").eq("household_id", householdId);
  existing = data.categoryId
    ? existing.eq("category_id", data.categoryId)
    : existing.is("category_id", null);
  const { data: found } = await existing.maybeSingle();

  if (data.amount === 0 && found) {
    await supabase.from("budgets").delete().eq("id", found.id);
    return { ok: true };
  }
  const { error } = found
    ? await supabase
        .from("budgets")
        .update({ amount: data.amount, updated_at: new Date().toISOString() })
        .eq("id", found.id)
    : await supabase
        .from("budgets")
        .insert({ household_id: householdId, category_id: data.categoryId, amount: data.amount });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getBills() {
  const userId = await getUserId();
  const { householdId } = await requireHousehold(supabase, userId);
  const { data, error } = await supabase
    .from("recurring_bills")
    .select("*")
    .eq("household_id", householdId)
    .order("due_day");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveBill({
  data,
}: {
  data: {
    id?: string | undefined;
    name: string;
    amount: number;
    dueDay: number;
    categoryId: string | null;
    isActive: boolean;
  };
}) {
  const userId = await getUserId();
  const { householdId } = await requireHousehold(supabase, userId);
  assertAmount(data.amount);
  if ((data.name ?? "").trim().length === 0) throw new Error("Bill name is required");
  if (data.dueDay < 1 || data.dueDay > 31)
    throw new Error("Due day must be between 1 and 31");
  const row = {
    household_id: householdId,
    name: data.name,
    amount: data.amount,
    due_day: data.dueDay,
    category_id: data.categoryId,
    is_active: data.isActive,
  };
  const { error } = data.id
    ? await supabase.from("recurring_bills").update(row).eq("id", data.id)
    : await supabase.from("recurring_bills").insert(row);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteBill({ data }: { data: { id: string } }) {
  const userId = await getUserId();
  await requireHousehold(supabase, userId);
  const { error } = await supabase.from("recurring_bills").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function payBill({ data }: { data: { id: string } }) {
  const userId = await getUserId();
  const { householdId } = await requireHousehold(supabase, userId);
  const { data: bill, error } = await supabase
    .from("recurring_bills")
    .select("*")
    .eq("id", data.id)
    .maybeSingle();
  if (error || !bill) throw new Error(error?.message ?? "Bill not found");
  const today = toDateKey(new Date());
  const { data: me } = await supabase
    .from("household_members")
    .select("id")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();
  const { error: insertError } = await supabase.from("expenses").insert({
    household_id: householdId,
    amount: bill.amount,
    category_id: bill.category_id,
    occurred_on: today,
    note: `${bill.name} (recurring bill)`,
    payment_type: "bank transfer",
    spender_id: me?.id ?? null,
    is_shared: true,
    is_essential: true,
    created_by: userId,
  });
  if (insertError) throw new Error(insertError.message);
  await supabase.from("recurring_bills").update({ last_paid_on: today }).eq("id", data.id);
  return { ok: true };
}

export async function getGoals() {
  const userId = await getUserId();
  const { householdId } = await requireHousehold(supabase, userId);
  const { data, error } = await supabase
    .from("savings_goals")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveGoal({
  data,
}: {
  data: {
    id?: string | undefined;
    name: string;
    targetAmount: number;
    savedAmount: number;
    targetDate: string | null;
  };
}) {
  const userId = await getUserId();
  const { householdId } = await requireHousehold(supabase, userId);
  assertAmount(data.targetAmount, "Target amount");
  assertAmount(data.savedAmount, "Saved amount");
  if ((data.name ?? "").trim().length === 0) throw new Error("Goal name is required");
  const row = {
    household_id: householdId,
    name: data.name,
    target_amount: data.targetAmount,
    saved_amount: data.savedAmount,
    target_date: data.targetDate,
  };
  const { error } = data.id
    ? await supabase.from("savings_goals").update(row).eq("id", data.id)
    : await supabase.from("savings_goals").insert(row);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteGoal({ data }: { data: { id: string } }) {
  const userId = await getUserId();
  await requireHousehold(supabase, userId);
  const { error } = await supabase.from("savings_goals").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getDashboard({ data = {} }: { data?: { offset?: number | undefined } } = {}) {
  const offset = data.offset ?? 0;
  const userId = await getUserId();
  const { householdId, profile } = await requireHousehold(supabase, userId);
  const cycle = getCycle(profile.cycle_start_day, new Date(), offset);
  const prev = getCycle(profile.cycle_start_day, new Date(), offset - 1);

  const [inc, exp, prevExp, cats, members, budgets, bills, goals] = await Promise.all([
    supabase
      .from("incomes")
      .select("*")
      .eq("household_id", householdId)
      .gte("occurred_on", toDateKey(cycle.start))
      .lte("occurred_on", toDateKey(cycle.end)),
    supabase
      .from("expenses")
      .select("*")
      .eq("household_id", householdId)
      .gte("occurred_on", toDateKey(cycle.start))
      .lte("occurred_on", toDateKey(cycle.end)),
    supabase
      .from("expenses")
      .select("amount, category_id")
      .eq("household_id", householdId)
      .gte("occurred_on", toDateKey(prev.start))
      .lte("occurred_on", toDateKey(prev.end)),
    supabase.from("categories").select("*").eq("household_id", householdId).order("sort_order"),
    supabase.from("household_members").select("*").eq("household_id", householdId),
    supabase.from("budgets").select("*").eq("household_id", householdId),
    supabase
      .from("recurring_bills")
      .select("*")
      .eq("household_id", householdId)
      .eq("is_active", true),
    supabase.from("savings_goals").select("*").eq("household_id", householdId),
  ]);

  const incomes = inc.data ?? [];
  const expenses = exp.data ?? [];
  const categories = cats.data ?? [];
  const memberRows = members.data ?? [];
  const budgetRows = budgets.data ?? [];

  const totalIncome = sum(incomes, (r) => r.amount);
  const totalExpenses = sum(expenses, (r) => r.amount);
  const balance = totalIncome - totalExpenses;
  const prevExpenses = sum(prevExp.data ?? [], (r) => r.amount);

  const byCategory = categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      isEssential: c.is_essential,
      spent: sum(
        expenses.filter((e) => e.category_id === c.id),
        (e) => e.amount,
      ),
      limit: num(budgetRows.find((b) => b.category_id === c.id)?.amount),
    }))
    .filter((c) => c.spent > 0 || c.limit > 0)
    .sort((a, b) => b.spent - a.spent);

  const byMember = memberRows
    .map((m) => ({
      id: m.id,
      name: m.name,
      color: m.color,
      relation: m.relation,
      spent: sum(
        expenses.filter((e) => e.spender_id === m.id),
        (e) => e.amount,
      ),
      earned: sum(
        incomes.filter((i) => i.member_id === m.id),
        (i) => i.amount,
      ),
    }))
    .sort((a, b) => b.spent - a.spent);

  const daily: Record<string, number> = {};
  for (const e of expenses) {
    daily[e.occurred_on] = (daily[e.occurred_on] ?? 0) + num(e.amount);
  }
  const trend = Object.entries(daily)
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const essential = sum(
    expenses.filter((e) => e.is_essential),
    (e) => e.amount,
  );
  const shared = sum(
    expenses.filter((e) => e.is_shared),
    (e) => e.amount,
  );

  const burnRate = cycle.daysElapsed > 0 ? totalExpenses / cycle.daysElapsed : 0;
  const upcomingBills = (bills.data ?? []).filter((b) => {
    const dueThisCycle = b.due_day >= new Date().getDate();
    return dueThisCycle && (!b.last_paid_on || b.last_paid_on < toDateKey(cycle.start));
  });
  const upcomingBillTotal = sum(upcomingBills, (b) => b.amount);
  const projectedSpend = totalExpenses + burnRate * cycle.daysLeft;
  const projectedBalance = totalIncome - projectedSpend - upcomingBillTotal;
  const safeDaily =
    cycle.daysLeft > 0 ? Math.max((balance - upcomingBillTotal) / cycle.daysLeft, 0) : 0;

  const overallLimit = num(budgetRows.find((b) => b.category_id === null)?.amount);
  const alerts: { level: "warning" | "over"; message: string }[] = [];
  if (overallLimit > 0) {
    const pct = totalExpenses / overallLimit;
    if (pct >= 1)
      alerts.push({
        level: "over",
        message: `You've crossed your overall monthly limit by ${Math.round((pct - 1) * 100)}%.`,
      });
    else if (pct >= 0.8)
      alerts.push({
        level: "warning",
        message: `You've used ${Math.round(pct * 100)}% of your overall monthly limit.`,
      });
  }
  for (const c of byCategory) {
    if (!c.limit) continue;
    const pct = c.spent / c.limit;
    if (pct >= 1)
      alerts.push({ level: "over", message: `${c.name} is over budget by ${Math.round((pct - 1) * 100)}%.` });
    else if (pct >= 0.8)
      alerts.push({ level: "warning", message: `${c.name} is at ${Math.round(pct * 100)}% of its budget.` });
  }
  if (projectedBalance < 0)
    alerts.push({
      level: "over",
      message: `At this pace you'll be short by about ${Math.round(Math.abs(projectedBalance))} before the next income date.`,
    });

  return {
    currency: profile.currency,
    cycle: {
      label: cycle.label,
      start: toDateKey(cycle.start),
      end: toDateKey(cycle.end),
      nextIncomeDate: toDateKey(cycle.nextIncomeDate),
      totalDays: cycle.totalDays,
      daysLeft: cycle.daysLeft,
      daysElapsed: cycle.daysElapsed,
    },
    totals: {
      income: totalIncome,
      expenses: totalExpenses,
      balance,
      prevExpenses,
      essential,
      nonEssential: totalExpenses - essential,
      shared,
      personal: totalExpenses - shared,
      overallLimit,
    },
    prediction: {
      burnRate,
      projectedSpend,
      projectedBalance,
      safeDaily,
      safeWeekly: safeDaily * 7,
      upcomingBillTotal,
      willLast: projectedBalance >= 0,
    },
    byCategory,
    byMember,
    trend,
    alerts,
    goals: (goals.data ?? []).map((g) => ({
      id: g.id,
      name: g.name,
      target: num(g.target_amount),
      saved: num(g.saved_amount),
      targetDate: g.target_date,
    })),
    recent: expenses
      .slice()
      .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on))
      .slice(0, 6)
      .map((e) => ({
        id: e.id,
        amount: num(e.amount),
        date: e.occurred_on,
        note: e.note,
        categoryId: e.category_id,
        spenderId: e.spender_id,
      })),
    accountType: profile.account_type,
  };
}
