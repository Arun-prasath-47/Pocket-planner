import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BellRing,
  ChartPie,
  PiggyBank,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pocket Planner — Household Budget & Expense Tracker" },
      {
        name: "description",
        content:
          "Track household income and expenses by member, set category budgets with early alerts, and see if your balance lasts until the next payday.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Wallet,
    title: "Income and expenses in one place",
    body: "Log fixed salaries, gig earnings, and every rupee spent with category, payment type, and a note.",
  },
  {
    icon: Users,
    title: "Built for households",
    body: "Add family members, tag who spent what, and separate shared costs from personal ones.",
  },
  {
    icon: ChartPie,
    title: "Budgets that warn you early",
    body: "Set overall and per-category limits. Get a nudge at 80%, a clear alert past 100%.",
  },
  {
    icon: PiggyBank,
    title: "Will it last?",
    body: "A month-end prediction tells you if your balance survives until the next income date, plus a safe daily spend.",
  },
  {
    icon: BellRing,
    title: "Bill reminders",
    body: "Rent, school fees, EMI, electricity, recharge — see what's due and log it as paid in one tap.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    body: "Your records are locked to your household account with secure sign-in.",
  },
];

function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Wallet className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">Pocket Planner</span>
        </div>
        <Button asChild variant={signedIn ? "default" : "ghost"}>
          <Link to={signedIn ? "/dashboard" : "/auth"}>{signedIn ? "Open app" : "Sign in"}</Link>
        </Button>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pt-10 pb-16 md:pt-20">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <p className="mb-4 inline-flex rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                Personal and household budgeting
              </p>
              <h1 className="text-4xl leading-tight font-semibold md:text-5xl">
                Know exactly where the money goes — and if it lasts until payday.
              </h1>
              <p className="mt-5 max-w-lg text-base text-muted-foreground">
                Pocket Planner is a calm, no-nonsense budget tracker for salaried earners, gig
                workers, and families sharing one household budget.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to={signedIn ? "/dashboard" : "/auth"}>
                    {signedIn ? "Go to dashboard" : "Start planning free"}
                    <ArrowRight className="ml-1 size-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="rounded-3xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <p className="text-sm text-muted-foreground">This cycle</p>
              <p className="money mt-1 text-4xl font-semibold">₹ 18,420</p>
              <p className="mt-1 text-sm text-muted-foreground">left of ₹ 62,000 income</p>
              <div className="mt-6 space-y-4">
                {[
                  { label: "Groceries", pct: 72, tone: "bg-primary" },
                  { label: "Transport", pct: 46, tone: "bg-chart-3" },
                  { label: "Entertainment", pct: 104, tone: "bg-destructive" },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{row.label}</span>
                      <span className="tabular text-muted-foreground">{row.pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${row.tone}`}
                        style={{ width: `${Math.min(row.pct, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground">
                Safe to spend <strong className="money">₹ 1,180</strong> per day for the next 14
                days.
              </div>
            </div>
          </div>
        </section>

        <section className="border-t bg-card/60">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title}>
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <f.icon className="size-5" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">{f.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 text-center">
          <h2 className="text-3xl font-semibold">Start with this month's spending</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Set up in under a minute. Add your income, log a few expenses, and the dashboard does
            the rest.
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link to={signedIn ? "/dashboard" : "/auth"}>Get started</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        Pocket Planner — budgeting for individuals and households.
      </footer>
    </div>
  );
}
