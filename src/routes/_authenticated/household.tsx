import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { bootstrapQuery } from "@/lib/queries";
import { deleteMember, saveMember } from "@/lib/pocket.functions";
import { memberColorVar } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/household")({
  head: () => ({
    meta: [
      { title: "Household — Pocket Planner" },
      { name: "description", content: "Manage members, relations and contributors to your budget." },
    ],
  }),
  component: HouseholdPage,
});

const RELATIONS = ["self", "father", "mother", "son", "daughter", "spouse", "other"] as const;
const PALETTE = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

function HouseholdPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(bootstrapQuery());
  const members = data?.members ?? [];

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<(typeof RELATIONS)[number]>("spouse");
  const [isIncomeContributor, setIsIncomeContributor] = useState(true);
  const [color, setColor] = useState("chart-2");

  function openAdd() {
    setEditingId(undefined);
    setName("");
    setRelation("spouse");
    setIsIncomeContributor(true);
    setColor(PALETTE[members.length % PALETTE.length]!);
    setOpen(true);
  }

  function openEdit(m: (typeof members)[number]) {
    setEditingId(m.id);
    setName(m.name);
    setRelation(m.relation as (typeof RELATIONS)[number]);
    setIsIncomeContributor(m.is_income_contributor);
    setColor(m.color || "chart-1");
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: () =>
      saveMember({
        data: {
          id: editingId,
          name: name.trim(),
          relation,
          isIncomeContributor,
          color,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Member saved");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMember({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Member removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Household"
      subtitle={data?.household?.name ?? "Household members"}
      actions={
        <Button onClick={openAdd}>
          <UserPlus className="size-4" /> Add member
        </Button>
      }
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit member" : "Add member"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mname">Name</Label>
              <Input
                id="mname"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Priya"
              />
            </div>
            <div className="space-y-2">
              <Label>Relation</Label>
              <Select value={relation} onValueChange={(v) => setRelation(v as (typeof RELATIONS)[number])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONS.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Badge color</Label>
              <div className="flex gap-2">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Select color ${c}`}
                    className={`size-8 rounded-full border-2 transition-all ${
                      color === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ background: memberColorVar(c) }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
              <span>
                Earns income
                <span className="block text-xs text-muted-foreground">
                  Includes this person in income contributor counts
                </span>
              </span>
              <Switch checked={isIncomeContributor} onCheckedChange={setIsIncomeContributor} />
            </label>
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
        ) : members.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No members added yet.</p>
        ) : (
          <ul className="divide-y">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="size-3.5 rounded-full"
                    style={{ background: memberColorVar(m.color) }}
                  />
                  <div>
                    <p className="text-sm font-semibold">{m.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {m.relation}
                      {m.is_income_contributor && " · Income contributor"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                    Edit
                  </Button>
                  {!m.user_id && (
                    <Button variant="ghost" size="icon" aria-label="Delete member" onClick={() => remove.mutate(m.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
