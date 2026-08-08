import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { goalsQuery, bootstrapQuery } from "@/lib/queries";
import { deleteGoal, saveGoal } from "@/lib/pocket.functions";
import { formatMoney } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({
    meta: [
      { title: "Goals — Pocket Planner" },
      { name: "description", content: "Track progress towards emergency funds and major savings goals." },
    ],
  }),
  component: GoalsPage,
});

function GoalsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(goalsQuery());
  const { data: boot } = useQuery(bootstrapQuery());
  const currency = boot?.profile?.currency ?? "INR";

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [savedAmount, setSavedAmount] = useState("0");
  const [targetDate, setTargetDate] = useState("");

  const save = useMutation({
    mutationFn: () =>
      saveGoal({
        data: {
          name: name.trim(),
          targetAmount: Number(targetAmount),
          savedAmount: Number(savedAmount || 0),
          targetDate: targetDate || null,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Goal saved");
      setOpen(false);
      setName("");
      setTargetAmount("");
      setSavedAmount("0");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteGoal({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Goal removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const money = (n: number) => formatMoney(n, currency, true);

  return (
    <AppShell
      title="Savings goals"
      subtitle="Emergency fund, vacation, festival savings"
      actions={
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Add goal
        </Button>
      }
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add savings goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gname">Goal name</Label>
              <Input
                id="gname"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Emergency Fund"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gtgt">Target amount</Label>
              <Input
                id="gtgt"
                inputMode="decimal"
                className="money"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="100000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gsaved">Saved so far</Label>
              <Input
                id="gsaved"
                inputMode="decimal"
                className="money"
                value={savedAmount}
                onChange={(e) => setSavedAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gdate">Target date</Label>
              <Input
                id="gdate"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="grid gap-4 sm:grid-cols-2">
        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : !data || data.length === 0 ? (
          <p className="col-span-full rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
            No savings goals created yet.
          </p>
        ) : (
          data.map((g) => {
            const target = Number(g.target_amount);
            const saved = Number(g.saved_amount);
            const pct = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
            return (
              <div
                key={g.id}
                className="relative rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold">{g.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {money(saved)} of {money(target)}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Delete goal" onClick={() => remove.mutate(g.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-right text-xs font-semibold tabular text-muted-foreground">
                  {Math.round(pct)}%
                </p>
              </div>
            );
          })
        )}
      </section>
    </AppShell>
  );
}
