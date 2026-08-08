import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { AppShell } from "@/components/app-shell";
import { AICopilotWidget } from "@/components/ai-copilot-widget";
import { TransactionDialog } from "@/components/transaction-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardQuery } from "@/lib/queries";
import { budgetStatus, formatMoney, memberColorVar } from "@/lib/finance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Pocket Planner" },
      {
        name: "description",
        content: "Income, expenses, remaining balance and month-end prediction for this cycle.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery(dashboardQuery(offset));
  const currency = data?.currency ?? "INR";
  const money = (n: number) => formatMoney(n, currency, true);

  return (
    <AppShell
      title="Dashboard"
      subtitle={data?.cycle.label ?? "This cycle"}
      actions={
        <>
          <div className="flex items-center rounded-lg border">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous cycle"
              onClick={() => setOffset((o) => Math.max(o - 1, -24))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next cycle"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.min(o + 1, 0))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Add
          </Button>
        </>
      }
    >
      <TransactionDialog open={open} onOpenChange={setOpen} />

      {isLoading || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {data.alerts.length > 0 && (
            <div className="space-y-2">
              {data.alerts.slice(0, 4).map((a, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
                    a.level === "over"
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-warning/30 bg-warning/10 text-warning-foreground",
                  )}
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Income" value={money(data.totals.income)} tone="positive" />
            <StatCard
              label="Expenses"
              value={money(data.totals.expenses)}
              tone="negative"
              hint={
                data.totals.prevExpenses > 0
                  ? `${data.totals.expenses >= data.totals.prevExpenses ? "+" : ""}${Math.round(
                      ((data.totals.expenses - data.totals.prevExpenses) /
                        data.totals.prevExpenses) *
                        100,
                    )}% vs last cycle`
                  : undefined
              }
            />
            <StatCard label="Balance left" value={money(data.totals.balance)} />
          </div>

          <AICopilotWidget contextData={data} />

          <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">Will it last?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.cycle.daysLeft} days until {format(parseISO(data.cycle.nextIncomeDate), "d MMM")}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  data.prediction.willLast
                    ? "bg-success/15 text-success"
                    : "bg-destructive/15 text-destructive",
                )}
              >
                {data.prediction.willLast ? "On track" : "Likely short"}
              </span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <MiniStat label="Safe to spend / day" value={money(data.prediction.safeDaily)} />
              <MiniStat label="Current burn rate / day" value={money(data.prediction.burnRate)} />
              <MiniStat
                label="Projected month-end"
                value={money(data.prediction.projectedBalance)}
                tone={data.prediction.projectedBalance >= 0 ? "positive" : "negative"}
              />
            </div>
            {data.prediction.upcomingBillTotal > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                Includes {money(data.prediction.upcomingBillTotal)} of bills still due this cycle.
              </p>
            )}
          </section>

          {data.trend.length > 1 && (
            <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
              <h2 className="font-display text-lg font-semibold">Daily spending</h2>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.trend} margin={{ left: -20, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="spend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v: string) => format(parseISO(v), "d MMM")}
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      width={70}
                      tickFormatter={(v: number) => formatMoney(v, currency, true)}
                    />
                    <Tooltip
                      formatter={(v) => formatMoney(Number(v), currency)}
                      labelFormatter={(v) => format(parseISO(String(v)), "d MMM yyyy")}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--card)",
                        color: "var(--card-foreground)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      fill="url(#spend)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
              <h2 className="font-display text-lg font-semibold">By category</h2>
              {data.byCategory.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No spending recorded yet.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {data.byCategory.slice(0, 8).map((c) => {
                    const status = budgetStatus(c.spent, c.limit);
                    const pct = c.limit ? Math.min((c.spent / c.limit) * 100, 100) : 0;
                    return (
                      <div key={c.id}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span>{c.name}</span>
                          <span className="tabular text-muted-foreground">
                            {money(c.spent)}
                            {c.limit > 0 && ` / ${money(c.limit)}`}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              status === "over"
                                ? "bg-destructive"
                                : status === "warning"
                                  ? "bg-warning"
                                  : "bg-primary",
                            )}
                            style={{ width: `${c.limit ? pct : 100}%`, opacity: c.limit ? 1 : 0.35 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
              <h2 className="font-display text-lg font-semibold">By member</h2>
              {data.byMember.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No members added.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {data.byMember.map((m) => (
                    <li key={m.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ background: memberColorVar(m.color) }}
                        />
                        {m.name}
                        <span className="text-xs text-muted-foreground capitalize">{m.relation}</span>
                      </span>
                      <span className="tabular">
                        {money(m.spent)}
                        {m.earned > 0 && (
                          <span className="ml-2 text-xs text-success">+{money(m.earned)}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Essential</p>
                  <p className="money font-semibold">{money(data.totals.essential)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Non-essential</p>
                  <p className="money font-semibold">{money(data.totals.nonEssential)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Shared</p>
                  <p className="money font-semibold">{money(data.totals.shared)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Personal</p>
                  <p className="money font-semibold">{money(data.totals.personal)}</p>
                </div>
              </div>
            </section>
          </div>

          {data.recent.length > 0 && (
            <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
              <h2 className="font-display text-lg font-semibold">Recent expenses</h2>
              <ul className="mt-3 divide-y">
                {data.recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span>
                      {r.note || "Expense"}
                      <span className="block text-xs text-muted-foreground">
                        {format(parseISO(r.date), "d MMM")}
                      </span>
                    </span>
                    <span className="money font-medium">{money(r.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: "positive" | "negative";
}) {
  const Icon = tone === "negative" ? TrendingDown : TrendingUp;
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {tone && (
          <Icon
            className={cn("size-4", tone === "positive" ? "text-success" : "text-muted-foreground")}
          />
        )}
      </div>
      <p className="money mt-2 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-xl bg-secondary/60 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "money mt-1 text-lg font-semibold",
          tone === "negative" && "text-destructive",
          tone === "positive" && "text-success",
        )}
      >
        {value}
      </p>
    </div>
  );
}
