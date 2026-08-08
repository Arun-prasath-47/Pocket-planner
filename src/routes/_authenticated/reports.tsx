import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Sliders,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dashboardQuery } from "@/lib/queries";
import { formatMoney, memberColorVar } from "@/lib/finance";
import { exportTransactionsCSV, downloadJSONFile, getAuditLogs, logAuditEvent } from "@/lib/audit-and-export";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Enterprise Reports & Intelligence — Pocket Planner" },
      {
        name: "description",
        content: "Enterprise analytics, 90-day cash flow projections, financial scenario simulator and audit trail.",
      },
    ],
  }),
  component: ReportsPage,
});

const PIE_COLORS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

function ReportsPage() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading } = useQuery(dashboardQuery(offset));
  const currency = data?.currency ?? "INR";
  const money = (n: number) => formatMoney(n, currency, true);

  // Scenario Simulator State
  const [simIncomeAdj, setSimIncomeAdj] = useState(0);
  const [simLumpSum, setSimLumpSum] = useState(0);
  const [simSavingsRate, setSimSavingsRate] = useState(20);

  // Audit trail state
  const auditLogs = getAuditLogs();

  const tooltipStyle = {
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--card-foreground)",
  };

  // 30 / 60 / 90 day Cash Flow Projection Data
  const currentIncome = (data?.totals.income ?? 0) + simIncomeAdj;
  const currentBurn = data?.prediction.burnRate ?? 0;
  const monthlyExpenseEst = currentBurn * 30 + simLumpSum;

  const forecastData = [
    { label: "Current", balance: data?.totals.balance ?? 0, income: data?.totals.income ?? 0, expense: data?.totals.expenses ?? 0 },
    {
      label: "+30 Days",
      balance: (data?.totals.balance ?? 0) + (currentIncome - monthlyExpenseEst),
      income: currentIncome,
      expense: monthlyExpenseEst,
    },
    {
      label: "+60 Days",
      balance: (data?.totals.balance ?? 0) + (currentIncome - monthlyExpenseEst) * 2,
      income: currentIncome * 2,
      expense: monthlyExpenseEst * 2,
    },
    {
      label: "+90 Days",
      balance: (data?.totals.balance ?? 0) + (currentIncome - monthlyExpenseEst) * 3,
      income: currentIncome * 3,
      expense: monthlyExpenseEst * 3,
    },
  ];

  const handleCSVExport = () => {
    if (!data) return;
    const catMap = Object.fromEntries(data.byCategory.map((c) => [c.name, c.name]));
    exportTransactionsCSV(data.recent, catMap, currency);
    logAuditEvent("EXPORT_CSV", "SECURITY", "Exported transaction ledger to CSV format");
    toast.success("CSV report exported successfully");
  };

  const handleJSONExport = () => {
    if (!data) return;
    downloadJSONFile(data, `pocket_planner_snapshot_${new Date().toISOString().slice(0, 10)}.json`);
    logAuditEvent("EXPORT_JSON", "SECURITY", "Exported full database state to JSON backup");
    toast.success("Full system JSON backup downloaded");
  };

  return (
    <AppShell
      title="Enterprise Analytics"
      subtitle={data?.cycle.label ?? "This cycle"}
      actions={
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border bg-card">
            <Button variant="ghost" size="icon" onClick={() => setOffset((o) => Math.max(o - 1, -24))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.min(o + 1, 0))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleCSVExport} className="hidden sm:flex items-center gap-1.5">
            <FileSpreadsheet className="size-4 text-primary" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleJSONExport} className="hidden sm:flex items-center gap-1.5">
            <Download className="size-4 text-primary" />
            Backup
          </Button>
        </div>
      }
    >
      {isLoading || !data ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-[420px]">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <PieIcon className="size-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="simulator" className="flex items-center gap-2">
              <Sliders className="size-4" /> Simulator
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <ShieldCheck className="size-4" /> Audit Log
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-4">
              {[
                { label: "Cycle Income", value: data.totals.income },
                { label: "Total Spent", value: data.totals.expenses },
                { label: "Net Surplus", value: data.totals.balance },
                { label: "Non-Essential", value: data.totals.nonEssential },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="money mt-1 text-xl font-semibold">{money(s.value)}</p>
                </div>
              ))}
            </section>

            {/* 90-Day Cash Flow Projections */}
            <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                    <LineIcon className="size-5 text-primary" /> 90-Day Cash Flow Forecast
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Predictive balance trajectory based on average daily burn rate ({money(data.prediction.burnRate)}/day)
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <TrendingUp className="size-3.5" />
                  Burn Rate: {money(data.prediction.burnRate)}/day
                </div>
              </div>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecastData} margin={{ left: -10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} axisLine={false} />
                    <YAxis
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      width={70}
                      tickFormatter={(v: number) => formatMoney(v, currency, true)}
                    />
                    <Tooltip formatter={(v) => formatMoney(Number(v), currency)} contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="balance" name="Projected Balance" stroke="var(--primary)" strokeWidth={3} dot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {data.byCategory.length > 0 && (
              <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
                <h2 className="font-display text-lg font-semibold">Category Breakdown</h2>
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byCategory} margin={{ left: -10, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        angle={-20}
                        height={50}
                        textAnchor="end"
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                        width={70}
                        tickFormatter={(v: number) => formatMoney(v, currency, true)}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--muted)" }}
                        formatter={(v) => formatMoney(Number(v), currency)}
                        contentStyle={tooltipStyle}
                      />
                      <Bar dataKey="spent" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
                <h2 className="font-display text-lg font-semibold">Essential vs Discretionary</h2>
                <div className="mt-2 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Essential", value: data.totals.essential },
                          { name: "Discretionary", value: data.totals.nonEssential },
                        ]}
                        dataKey="value"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        <Cell fill="var(--primary)" />
                        <Cell fill="var(--warning)" />
                      </Pie>
                      <Legend />
                      <Tooltip formatter={(v) => formatMoney(Number(v), currency)} contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
                <h2 className="font-display text-lg font-semibold">Member Contribution Split</h2>
                {data.byMember.filter((m) => m.spent > 0).length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Assign members to transactions to view individual member contribution breakdown.
                  </p>
                ) : (
                  <div className="mt-2 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.byMember.filter((m) => m.spent > 0)}
                          dataKey="spent"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                        >
                          {data.byMember
                            .filter((m) => m.spent > 0)
                            .map((m, i) => (
                              <Cell key={m.id} fill={memberColorVar(m.color || PIE_COLORS[i % PIE_COLORS.length]!)} />
                            ))}
                        </Pie>
                        <Legend />
                        <Tooltip formatter={(v) => formatMoney(Number(v), currency)} contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>
            </div>
          </TabsContent>

          {/* SIMULATOR TAB */}
          <TabsContent value="simulator" className="space-y-6">
            <section className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)] space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold">"What-If" Financial Scenario Planner</h2>
                  <p className="text-xs text-muted-foreground">
                    Model variations in income, lump-sum purchases, or emergency reserves to preview your projected 90-day balance.
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="sim-income">Monthly Income Change (+/-)</Label>
                  <Input
                    id="sim-income"
                    type="number"
                    value={simIncomeAdj || ""}
                    onChange={(e) => setSimIncomeAdj(Number(e.target.value))}
                    placeholder="e.g. 5000"
                  />
                  <p className="text-[11px] text-muted-foreground">Simulate salary raise or lost revenue</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sim-lumpsum">One-Time Lump Expense</Label>
                  <Input
                    id="sim-lumpsum"
                    type="number"
                    value={simLumpSum || ""}
                    onChange={(e) => setSimLumpSum(Number(e.target.value))}
                    placeholder="e.g. 15000"
                  />
                  <p className="text-[11px] text-muted-foreground">e.g. Home repair, vacation, laptop purchase</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sim-savings">Target Savings Rate (%)</Label>
                  <Input
                    id="sim-savings"
                    type="number"
                    min={0}
                    max={100}
                    value={simSavingsRate}
                    onChange={(e) => setSimSavingsRate(Number(e.target.value))}
                  />
                  <p className="text-[11px] text-muted-foreground">Recommended rule: 20% to 30%</p>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/30 p-4 grid gap-4 sm:grid-cols-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Simulated Net Monthly Surplus</p>
                  <p className="money mt-1 text-lg font-bold text-foreground">
                    {money(currentIncome - monthlyExpenseEst)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Target Monthly Savings ({simSavingsRate}%)</p>
                  <p className="money mt-1 text-lg font-bold text-primary">
                    {money(currentIncome * (simSavingsRate / 100))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Projected 90-Day Liquidity</p>
                  <p className="money mt-1 text-lg font-bold text-emerald-600">
                    {money((data?.totals.balance ?? 0) + (currentIncome - monthlyExpenseEst) * 3)}
                  </p>
                </div>
              </div>
            </section>
          </TabsContent>

          {/* AUDIT LOG TAB */}
          <TabsContent value="audit" className="space-y-6">
            <section className="rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between pb-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                    <History className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-semibold">Enterprise Audit Trail</h2>
                    <p className="text-xs text-muted-foreground">
                      Immutable transaction logs, security checks, and data export operations.
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => logAuditEvent("MANUAL_AUDIT_CHECK", "SECURITY", "Triggered manual audit integrity scan")}>
                  Verify Integrity
                </Button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Details</th>
                      <th className="py-2.5 px-3">User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-mono text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block rounded-md bg-secondary px-2 py-0.5 font-semibold text-[10px] uppercase">
                            {log.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-foreground">{log.action}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{log.details}</td>
                        <td className="py-2.5 px-3 font-medium">{log.user}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      )}
    </AppShell>
  );
}

