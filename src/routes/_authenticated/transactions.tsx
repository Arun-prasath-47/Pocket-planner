import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { TransactionDialog, type TxDraft } from "@/components/transaction-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { bootstrapQuery, transactionsQuery, type TransactionFilters } from "@/lib/queries";
import { deleteTransaction } from "@/lib/pocket.functions";
import { formatMoney } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — Pocket Planner" },
      {
        name: "description",
        content: "Search, filter and edit every income and expense record in your budget.",
      },
    ],
  }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TransactionFilters>({ kind: "all", tag: "all" });
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TxDraft | undefined>(undefined);
  const [confirmTarget, setConfirmTarget] = useState<
    { id: string; kind: "expense" | "income" } | undefined
  >(undefined);

  const { data: boot } = useQuery(bootstrapQuery());
  const currency = boot?.profile?.currency ?? "INR";
  const categories = boot?.categories ?? [];
  const members = boot?.members ?? [];

  const { data, isLoading } = useQuery(transactionsQuery({ ...filters, search: search || undefined }));

  const rows = useMemo(() => {
    const expenses = (data?.expenses ?? []).map((e) => ({
      id: e.id,
      kind: "expense" as const,
      amount: Number(e.amount),
      date: e.occurred_on,
      title: e.note || categories.find((c) => c.id === e.category_id)?.name || "Expense",
      category: categories.find((c) => c.id === e.category_id)?.name ?? "Uncategorised",
      member: members.find((m) => m.id === e.spender_id)?.name,
      isShared: e.is_shared,
      isEssential: e.is_essential,
      raw: e,
    }));
    const incomes = (data?.incomes ?? []).map((i) => ({
      id: i.id,
      kind: "income" as const,
      amount: Number(i.amount),
      date: i.occurred_on,
      title: i.source || "Income",
      category: i.frequency,
      member: members.find((m) => m.id === i.member_id)?.name,
      isShared: true,
      isEssential: true,
      raw: i,
    }));
    return [...expenses, ...incomes].sort((a, b) => b.date.localeCompare(a.date));
  }, [data, categories, members]);

  const remove = useMutation({
    mutationFn: (v: { id: string; kind: "expense" | "income" }) => deleteTransaction({ data: v }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setConfirmTarget(undefined);
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function edit(row: (typeof rows)[number]) {
    if (row.kind === "expense") {
      const e = row.raw as NonNullable<typeof data>["expenses"][number];
      setDraft({
        kind: "expense",
        id: e.id,
        amount: Number(e.amount),
        date: e.occurred_on,
        note: e.note ?? "",
        categoryId: e.category_id,
        spenderId: e.spender_id,
        beneficiaryId: e.beneficiary_id,
        isShared: e.is_shared,
        isEssential: e.is_essential,
        paymentType: e.payment_type ?? "cash",
      });
    } else {
      const i = row.raw as NonNullable<typeof data>["incomes"][number];
      setDraft({
        kind: "income",
        id: i.id,
        amount: Number(i.amount),
        date: i.occurred_on,
        note: i.note ?? "",
        source: i.source ?? "",
        frequency: i.frequency ?? "monthly",
        memberId: i.member_id,
      });
    }
    setOpen(true);
  }

  return (
    <AppShell
      title="Transactions"
      subtitle={`${rows.length} records`}
      actions={
        <Button
          onClick={() => {
            setDraft(undefined);
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Add
        </Button>
      }
    >
      <TransactionDialog open={open} onOpenChange={setOpen} draft={draft} />

      <div className="space-y-3 rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="relative">
          <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes and sources"
            className="pl-9"
            maxLength={80}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            value={filters.kind ?? "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, kind: v as TransactionFilters["kind"] }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
              <SelectItem value="income">Income</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.categoryId ?? "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, categoryId: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.memberId ?? "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, memberId: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.tag ?? "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, tag: v as TransactionFilters["tag"] }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              <SelectItem value="shared">Shared</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="essential">Essential</SelectItem>
              <SelectItem value="non-essential">Non-essential</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={filters.from ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value || undefined }))}
          />
          <Input
            type="date"
            value={filters.to ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value || undefined }))}
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border bg-card shadow-[var(--shadow-card)]">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium">
              {filters.kind !== "all" ||
              filters.categoryId ||
              filters.memberId ||
              filters.tag !== "all" ||
              search
                ? "No transactions match these filters"
                : "No transactions recorded yet"}
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                setDraft(undefined);
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> Add a transaction
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={`${row.kind}-${row.id}`} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{format(parseISO(row.date), "d MMM yyyy")}</span>
                    <span>·</span>
                    <span className="capitalize">{row.category}</span>
                    {row.member && (
                      <>
                        <span>·</span>
                        <span>{row.member}</span>
                      </>
                    )}
                    {row.kind === "expense" && (
                      <>
                        <Badge variant="secondary" className="ml-1">
                          {row.isShared ? "Shared" : "Personal"}
                        </Badge>
                        {!row.isEssential && <Badge variant="outline">Non-essential</Badge>}
                      </>
                    )}
                  </div>
                </div>
                <span
                  className={`money text-sm font-semibold ${row.kind === "income" ? "text-success" : ""}`}
                >
                  {row.kind === "income" ? "+" : "−"}
                  {formatMoney(row.amount, currency, true)}
                </span>
                <Button variant="ghost" size="icon" aria-label="Edit transaction" onClick={() => edit(row)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete transaction"
                  onClick={() => setConfirmTarget({ id: row.id, kind: row.kind })}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirmTarget !== undefined}
        onOpenChange={(v) => {
          if (!v) setConfirmTarget(undefined);
        }}
        title={`Delete this ${confirmTarget?.kind === "income" ? "income" : "expense"}?`}
        description="This permanently removes the transaction from your records. This action cannot be undone."
        confirmLabel="Delete entry"
        loading={remove.isPending}
        onConfirm={() => {
          if (confirmTarget) remove.mutate(confirmTarget);
        }}
      />
    </AppShell>
  );
}
