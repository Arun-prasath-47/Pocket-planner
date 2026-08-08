import { queryOptions } from "@tanstack/react-query";
import {
  getBills,
  getBootstrap,
  getBudgets,
  getDashboard,
  getGoals,
  listTransactions,
} from "@/lib/pocket.functions";

export type TransactionFilters = {
  from?: string | undefined;
  to?: string | undefined;
  categoryId?: string | undefined;
  memberId?: string | undefined;
  kind?: "all" | "expense" | "income" | undefined;
  tag?: "all" | "shared" | "personal" | "essential" | "non-essential" | undefined;
  search?: string | undefined;
};

export const bootstrapQuery = () =>
  queryOptions({
    queryKey: ["bootstrap"],
    queryFn: () => getBootstrap(),
    staleTime: 30_000,
  });

export const dashboardQuery = (offset = 0) =>
  queryOptions({
    queryKey: ["dashboard", offset],
    queryFn: () => getDashboard({ data: { offset } }),
  });

export const budgetsQuery = () =>
  queryOptions({ queryKey: ["budgets"], queryFn: () => getBudgets() });

export const billsQuery = () => queryOptions({ queryKey: ["bills"], queryFn: () => getBills() });

export const goalsQuery = () => queryOptions({ queryKey: ["goals"], queryFn: () => getGoals() });

export const transactionsQuery = (filters: TransactionFilters) =>
  queryOptions({
    queryKey: ["transactions", filters],
    queryFn: () => listTransactions({ data: filters }),
  });

export const REFRESH_KEYS = [
  ["dashboard"],
  ["transactions"],
  ["budgets"],
  ["bills"],
  ["goals"],
  ["bootstrap"],
];
