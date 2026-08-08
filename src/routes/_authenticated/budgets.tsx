import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { budgetsQuery, bootstrapQuery } from "@/lib/queries";
import { saveBudget } from "@/lib/pocket.functions";
import { budgetStatus, formatMoney } from "@/lib/finance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/budgets")({
  head: () => ({
    meta: [
      { title: "Budgets — Pocket Planner" },
      {
        name: "description",
        content: "Set an overall monthly limit and category budgets, and watch spending against them.",
      },
    ],
  }),
  component: BudgetsPage,
});

function BudgetsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(budgetsQuery());
  const { data: boot } = useQuery(bootstrapQuery());
  const currency = boot?.profile?.currency ?? "INR";
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = { overall: data.overall.limit ? String(data.overall.limit) : "" };
    for (const c of data.categories) next[c.id] = c.limit ? String(c.limit) : "";
    setDrafts(next);
  }, [data]);

  const save = useMutation({
    mutationFn: (v: { categoryId: string | null; amount: number }) => saveBudget({ data: v }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Budget updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const money = (n: number) => formatMoney(n, currency, true);

  return (
    <AppShell title="Budgets" subtitle={data?.cycleLabel ?? "This cycle"}>
      {isLoading || !data ? (
        <Skeleton className="h-72 w-full rounded-2xl" />
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="font-display text-lg font-semibold">Overall monthly limit</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Spent {money(data.overall.spent)}
              {data.overall.limit > 0 && ` of ${money(data.overall.limit)}`}
            </p>
            <div className="mt-4 flex gap-2">
              <Input
                inputMode="decimal"
                className="money"
                value={drafts["overall"] ?? ""}
                placeholder="No limit"
                onChange={(e) => setDrafts((d) => ({ ...d, overall: e.target.value }))}
              />
              <Button
                onClick={() => save.mutate({ categoryId: null, amount: Number(drafts["overall"] || 0) })}
                disabled={save.isPending}
              >
                Save
              </Button>
            </div>
            {data.overall.limit > 0 && (
              <Bar spent={data.overall.spent} limit={data.overall.limit} className="mt-4" />
            )}
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="font-display text-lg font-semibold">Category budgets</h2>
            <div className="mt-4 space-y-5">
              {data.categories.map((c) => (
                <div key={c.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-sm">
                      {c.name}
                      {c.isEssential && (
                        <span className="ml-2 text-xs text-muted-foreground">essential</span>
                      )}
                    </Label>
                    <span className="tabular text-xs text-muted-foreground">
                      {money(c.spent)}
                      {c.limit > 0 && ` / ${money(c.limit)}`}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Input
                      inputMode="decimal"
                      className="money"
                      placeholder="No limit"
                      value={drafts[c.id] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                    />
                    <Button
                      variant="outline"
                      onClick={() => save.mutate({ categoryId: c.id, amount: Number(drafts[c.id] || 0) })}
                      disabled={save.isPending}
                    >
                      Save
                    </Button>
                  </div>
                  {c.limit > 0 && <Bar spent={c.spent} limit={c.limit} className="mt-2" />}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function Bar({ spent, limit, className }: { spent: number; limit: number; className?: string }) {
  const status = budgetStatus(spent, limit);
  const pct = Math.min((spent / limit) * 100, 100);
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn(
          "h-full rounded-full",
          status === "over" ? "bg-destructive" : status === "warning" ? "bg-warning" : "bg-primary",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
