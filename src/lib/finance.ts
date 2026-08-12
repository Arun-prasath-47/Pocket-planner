import {
  addMonths,
  differenceInCalendarDays,
  endOfDay,
  format,
  setDate,
  startOfDay,
  subMonths,
} from "date-fns";

export type CycleRange = {
  start: Date;
  end: Date;
  /** Date the next income cycle begins (day after `end`). */
  nextIncomeDate: Date;
  totalDays: number;
  daysElapsed: number;
  daysLeft: number;
  label: string;
};

function clampDay(date: Date, day: number) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return setDate(date, Math.min(day, lastDay));
}

export function getCycle(cycleStartDay = 1, ref: Date = new Date(), offset = 0): CycleRange {
  const day = Math.min(Math.max(cycleStartDay || 1, 1), 28);
  let start = clampDay(ref, day);
  if (ref.getDate() < day) start = clampDay(subMonths(ref, 1), day);
  start = startOfDay(addMonths(start, offset));
  const nextIncomeDate = startOfDay(clampDay(addMonths(start, 1), day));
  const end = endOfDay(new Date(nextIncomeDate.getTime() - 86400000));
  const totalDays = Math.max(differenceInCalendarDays(nextIncomeDate, start), 1);
  const today = startOfDay(new Date());
  const daysElapsed = Math.min(Math.max(differenceInCalendarDays(today, start) + 1, 0), totalDays);
  const daysLeft = Math.max(totalDays - daysElapsed, 0);
  return {
    start,
    end,
    nextIncomeDate,
    totalDays,
    daysElapsed,
    daysLeft,
    label:
      day === 1
        ? format(start, "MMMM yyyy")
        : `${format(start, "d MMM")} – ${format(end, "d MMM yyyy")}`,
  };
}

export function toDateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function formatMoney(amount: number, currency = "INR", compact = false) {
  const locale = currency === "INR" ? "en-IN" : "en-US";
  const useCompact = compact && Math.abs(amount) >= 100000;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: useCompact ? 1 : 0,
      minimumFractionDigits: 0,
      notation: useCompact ? "compact" : "standard",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

export const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar" },
];

export const CURRENCY_SYMBOLS: Record<string, string> = Object.fromEntries(
  CURRENCIES.map((c) => [c.code, c.symbol]),
);

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? (currency || "INR");
}

export const PAYMENT_TYPES = ["cash", "card", "bank transfer", "wallet", "other"];

export const RELATIONS = [
  "self",
  "father",
  "mother",
  "son",
  "daughter",
  "spouse",
  "other",
] as const;

export const MEMBER_COLORS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

export function memberColorVar(color: string) {
  return `var(--${color || "chart-1"})`;
}

export type BudgetStatus = "safe" | "warning" | "over";

export function budgetStatus(spent: number, limit: number): BudgetStatus {
  if (!limit) return "safe";
  const pct = spent / limit;
  if (pct >= 1) return "over";
  if (pct >= 0.8) return "warning";
  return "safe";
}
