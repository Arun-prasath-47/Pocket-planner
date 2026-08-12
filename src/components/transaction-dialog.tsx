import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_TYPES, toDateKey } from "@/lib/finance";
import { bootstrapQuery } from "@/lib/queries";
import { saveExpense, saveIncome } from "@/lib/pocket.functions";

export type TxDraft = {
  kind: "expense" | "income";
  id?: string | undefined;
  amount?: number | undefined;
  date?: string | undefined;
  note?: string | undefined;
  source?: string | undefined;
  frequency?: string | undefined;
  categoryId?: string | null | undefined;
  spenderId?: string | null | undefined;
  beneficiaryId?: string | null | undefined;
  memberId?: string | null | undefined;
  isShared?: boolean | undefined;
  isEssential?: boolean | undefined;
  paymentType?: string | undefined;
};

const NONE = "none";

export function TransactionDialog({
  open,
  onOpenChange,
  draft,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft?: TxDraft | undefined;
}) {
  const queryClient = useQueryClient();
  const { data: boot } = useQuery(bootstrapQuery());
  const categories = boot?.categories ?? [];
  const members = boot?.members ?? [];

  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(toDateKey(new Date()));
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState<string>(NONE);
  const [paymentType, setPaymentType] = useState("cash");
  const [spenderId, setSpenderId] = useState<string>(NONE);
  const [beneficiaryId, setBeneficiaryId] = useState<string>(NONE);
  const [isShared, setIsShared] = useState(true);
  const [isEssential, setIsEssential] = useState(true);
  const [source, setSource] = useState("Salary");
  const [frequency, setFrequency] = useState("monthly");

  useEffect(() => {
    if (!open) return;
    const d = draft;
    setKind(d?.kind ?? "expense");
    setAmount(d?.amount ? String(d.amount) : "");
    setDate(d?.date ?? toDateKey(new Date()));
    setNote(d?.note ?? "");
    setCategoryId(d?.categoryId ?? NONE);
    setPaymentType(d?.paymentType ?? "cash");
    setSpenderId(d?.spenderId ?? d?.memberId ?? NONE);
    setBeneficiaryId(d?.beneficiaryId ?? NONE);
    setIsShared(d?.isShared ?? true);
    setIsEssential(d?.isEssential ?? true);
    setSource(d?.source ?? "Salary");
    setFrequency(d?.frequency ?? "monthly");
  }, [open, draft]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const noteRequired = kind === "expense" && (!selectedCategory || /^other/i.test(selectedCategory.name.trim()));

  const save = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error("Enter a valid amount");
      if (kind === "expense") {
        if (noteRequired && !note.trim()) {
          throw new Error(
            selectedCategory
              ? `Add a short note for "${selectedCategory.name}" so this entry stays trackable`
              : "Add a short note for uncategorised entries so they stay trackable",
          );
        }
        return saveExpense({
          data: {
            ...(draft?.id ? { id: draft.id } : {}),
            amount: value,
            categoryId: categoryId === NONE ? null : categoryId,
            occurredOn: date,
            note: note.trim(),
            paymentType,
            spenderId: spenderId === NONE ? null : spenderId,
            beneficiaryId: beneficiaryId === NONE ? null : beneficiaryId,
            isShared,
            isEssential,
          },
        });
      }
      return saveIncome({
        data: {
          ...(draft?.id ? { id: draft.id } : {}),
          amount: value,
          occurredOn: date,
          source: source.trim() || "Income",
          frequency: frequency as "monthly" | "weekly" | "biweekly" | "irregular",
          memberId: spenderId === NONE ? null : spenderId,
          note: note.trim(),
        },
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries();
      toast.success(kind === "expense" ? "Expense saved" : "Income saved");
      if (result && "overallBudget" in result) {
        const r = result as unknown as {
          overallBudget: number;
          overallSpent: number;
          categoryBudget: number;
          categorySpent: number;
        };
        if (r.overallBudget > 0 && r.overallSpent >= r.overallBudget) {
          toast.warning("You've crossed your overall monthly budget.");
        } else if (r.overallBudget > 0 && r.overallSpent >= r.overallBudget * 0.8) {
          toast.warning("You're at 80% of your overall monthly budget.");
        } else if (r.categoryBudget > 0 && r.categorySpent >= r.categoryBudget) {
          toast.warning("This category is over its budget.");
        }
      }
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{draft?.id ? "Edit entry" : "Add entry"}</DialogTitle>
        </DialogHeader>

        {!draft?.id && (
          <Tabs value={kind} onValueChange={(v) => setKind(v as "expense" | "income")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="expense">Expense</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="money text-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {kind === "expense" ? (
            <>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Uncategorised" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Uncategorised</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Payment type</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPES.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {members.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Spent by</Label>
                    <Select value={spenderId} onValueChange={setSpenderId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Anyone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not specified</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Spent for</Label>
                    <Select value={beneficiaryId} onValueChange={setBeneficiaryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Everyone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Everyone</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid gap-3 rounded-xl border p-3">
                <label className="flex items-center justify-between text-sm">
                  <span>
                    Shared household expense
                    <span className="block text-xs text-muted-foreground">
                      Turn off for a personal expense
                    </span>
                  </span>
                  <Switch checked={isShared} onCheckedChange={setIsShared} />
                </label>
                <label className="flex items-center justify-between text-sm">
                  <span>
                    Essential
                    <span className="block text-xs text-muted-foreground">
                      Turn off for avoidable spending
                    </span>
                  </span>
                  <Switch checked={isEssential} onCheckedChange={setIsEssential} />
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  value={source}
                  maxLength={60}
                  onChange={(e) => setSource(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["monthly", "weekly", "biweekly", "irregular"].map((f) => (
                      <SelectItem key={f} value={f} className="capitalize">
                        {f.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {members.length > 0 && (
                <div className="space-y-2">
                  <Label>Earned by</Label>
                  <Select value={spenderId} onValueChange={setSpenderId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Not specified" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not specified</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="note">
              Note
              {noteRequired && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">(required)</span>
              )}
            </Label>
            <Textarea
              id="note"
              value={note}
              maxLength={200}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
