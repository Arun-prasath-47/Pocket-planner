import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  BellRing,
  ChartPie,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  MoreHorizontal,
  PiggyBank,
  Settings,
  Target,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { bootstrapQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AICommandBar } from "@/components/ai-command-bar";

export const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: ListOrdered },
  { to: "/budgets", label: "Budgets", icon: PiggyBank },
  { to: "/reports", label: "Reports", icon: ChartPie },
  { to: "/household", label: "Household", icon: Users },
  { to: "/reminders", label: "Bills", icon: BellRing },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const PRIMARY_MOBILE_NAV = NAV.slice(0, 4);

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data, isFetching } = useQuery(bootstrapQuery());
  const [moreOpen, setMoreOpen] = useState(false);

  const onboarded = data?.profile?.onboarded;
  useEffect(() => {
    if (data && !onboarded && !isFetching && pathname !== "/onboarding") {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [data, onboarded, isFetching, pathname, navigate]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const secondaryNavActive = NAV.slice(4).some((item) => item.to === pathname);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-card px-3 py-5 lg:flex">
        <Link to="/dashboard" className="mb-6 flex items-center gap-2 px-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Wallet className="size-5" />
          </span>
          <span className="font-display text-base font-semibold">Pocket Planner</span>
        </Link>
        <nav className="flex-1 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                pathname === item.to && "bg-secondary text-secondary-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t pt-3">
          <p className="truncate px-3 text-xs text-muted-foreground">
            {data?.household?.name ?? "Your household"}
          </p>
          <Button variant="ghost" className="mt-1 w-full justify-start gap-3" onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <h1 className="font-display text-xl font-semibold">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
              <AICommandBar
                categories={data?.categories || []}
                members={data?.members || []}
                currency={data?.profile?.currency || "INR"}
              />
              {actions}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-5 pt-6 pb-28 lg:pb-12">{children}</main>
      </div>

      {/* Mobile drawer for overflow menu */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setMoreOpen(false)}>
          <div
            className="fixed inset-x-0 bottom-16 border-t bg-card p-4 shadow-2xl rounded-t-2xl space-y-2 animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 pb-2 border-b">
              <span className="text-sm font-semibold text-muted-foreground">More Menu</span>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setMoreOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {NAV.slice(4).map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3 text-sm font-medium border bg-background text-foreground transition-colors",
                    pathname === item.to && "border-primary bg-primary/10 text-primary font-semibold",
                  )}
                >
                  <item.icon className="size-5 text-primary" />
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="pt-2 border-t">
              <Button variant="outline" className="w-full justify-center gap-2 text-destructive" onClick={signOut}>
                <LogOut className="size-4" /> Sign out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card lg:hidden">
        {PRIMARY_MOBILE_NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground",
              pathname === item.to && "text-primary font-semibold",
            )}
          >
            <item.icon className="size-5" />
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
          className={cn(
            "flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground",
            (moreOpen || secondaryNavActive) && "text-primary font-semibold",
          )}
        >
          <MoreHorizontal className="size-5" />
          More
        </button>
      </nav>
    </div>
  );
}
