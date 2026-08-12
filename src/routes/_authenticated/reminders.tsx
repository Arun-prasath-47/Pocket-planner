import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { BellRing, CheckCircle2, Plus, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { billsQuery, bootstrapQuery } from "@/lib/queries";
import { deleteBill, payBill, saveBill } from "@/lib/pocket.functions";
import { formatMoney, toDateKey } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({
    meta: [
      { title: "Bills — Pocket Planner" },
      { name: "description", content: "Recurring monthly bill reminders with one-tap payment recording." },
    ],
  }),
  component: RemindersPage,
});

function RemindersPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(billsQuery());
  const { data: boot } = useQuery(bootstrapQuery());
  const currency = boot?.profile?.currency ?? "INR";
  const categories = boot?.categories ?? [];

  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [categoryId, setCategoryId] = useState<string>("none");

  const save = useMutation({
    mutationFn: () =>
      saveBill({
        data: {
          name: name.trim(),
          amount: Number(amount),
          dueDay: Number(dueDay),
          categoryId: categoryId === "none" ? null : categoryId,
          isActive: true,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Bill added");
      setOpen(false);
      setName("");
      setAmount("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pay = useMutation({
    mutationFn: (id: string) => payBill({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Bill logged as paid in expenses");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBill({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setConfirmId(null);
      toast.success("Bill removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const money = (n: number) => formatMoney(n, currency, true);
  const todayKey = toDateKey(new Date());

  return (
    <AppShell
      title="Recurring bills"
      subtitle="Rent, school fees, EMIs, electricity"
      actions={
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Add bill
        </Button>
      }
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add recurring bill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bname">Bill name</Label>
              <Input
                id="bname"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rent"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bamt">Amount</Label>
              <Input
                id="bamt"
                inputMode="decimal"
                className="money"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bday">Due day of month</Label>
              <Input
                id="bday"
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorised</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
        {isLoading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : !data || data.length === 0 ? (
          <div className="p-10 text-center">
            <BellRing className="mx-auto size-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">No recurring bills yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add rent, EMIs, subscriptions or school fees and mark them paid each month so they
              show up in your budget automatically.
            </p>
            <Button className="mt-4" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Add your first bill
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {data.map((b) => {
              const paidThisMonth = b.last_paid_on && b.last_paid_on.slice(0, 7) === todayKey.slice(0, 7);
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Due on day {b.due_day} of every month · {money(Number(b.amount))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {paidThisMonth ? (
                      <span className="flex items-center gap-1 text-xs text-success">
                        <CheckCircle2 className="size-4" /> Paid this month
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => pay.mutate(b.id)}
                        disabled={pay.isPending}
                      >
                        Mark paid
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete bill"
                      onClick={() => setConfirmId(b.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(v) => {
          if (!v) setConfirmId(null);
        }}
        title="Delete this bill?"
        description="The recurring bill and its schedule will be removed. Past payments recorded as expenses are kept."
        confirmLabel="Delete bill"
        loading={remove.isPending}
        onConfirm={() => {
          if (confirmId) remove.mutate(confirmId);
        }}
      />
    </AppShell>
  );
}
