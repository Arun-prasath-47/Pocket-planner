import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { completeOnboarding } from "@/lib/pocket.functions";
import { CURRENCIES } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome — Pocket Planner" },
      { name: "description", content: "Set up your household budget and members." },
    ],
  }),
  component: OnboardingPage,
});

type MemberItem = {
  name: string;
  relation: "self" | "father" | "mother" | "son" | "daughter" | "spouse" | "other";
  isIncomeContributor: boolean;
};

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [accountType, setAccountType] = useState<"individual" | "household">("household");
  const [householdName, setHouseholdName] = useState("Our Household");
  const [currency, setCurrency] = useState("INR");
  const [cycleStartDay, setCycleStartDay] = useState(1);
  const [members, setMembers] = useState<MemberItem[]>([
    { name: "Spouse", relation: "spouse", isIncomeContributor: true },
  ]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!fullName.trim()) throw new Error("Please enter your name");
      if (!householdName.trim()) throw new Error("Please enter a household name");
      return completeOnboarding({
        data: {
          fullName: fullName.trim(),
          accountType,
          householdName: householdName.trim(),
          currency,
          cycleStartDay,
          members: accountType === "household" ? members : [],
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Welcome to Pocket Planner!");
      navigate({ to: "/dashboard", replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Wallet className="size-5" />
        </span>
        <span className="font-display text-lg font-semibold">Pocket Planner</span>
      </div>

      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-[var(--shadow-card)]">
        <h1 className="font-display text-xl font-semibold">Set up your budget</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell us about your household so we can calculate cycle dates and member balances.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
          className="mt-6 space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="ofn">Your name</Label>
            <Input
              id="ofn"
              value={fullName}
              maxLength={80}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rahul"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Who is this budget for?</Label>
            <Select
              value={accountType}
              onValueChange={(v) => setAccountType(v as "individual" | "household")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Just me (Individual)</SelectItem>
                <SelectItem value="household">Family / Household (Multiple members)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {accountType === "household" && (
            <div className="space-y-2">
              <Label htmlFor="ohn">Household name</Label>
              <Input
                id="ohn"
                value={householdName}
                maxLength={80}
                onChange={(e) => setHouseholdName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} ({c.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="oday">Salary date (1–28)</Label>
              <Input
                id="oday"
                type="number"
                min={1}
                max={28}
                value={cycleStartDay}
                onChange={(e) => setCycleStartDay(Number(e.target.value))}
              />
            </div>
          </div>

          {accountType === "household" && (
            <div className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Other family members</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setMembers((m) => [
                      ...m,
                      { name: "", relation: "other", isIncomeContributor: false },
                    ])
                  }
                >
                  <Plus className="size-4" /> Add
                </Button>
              </div>

              {members.map((m, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 border-t pt-3">
                  <Input
                    className="min-w-28 flex-1"
                    placeholder="Member name"
                    value={m.name}
                    maxLength={60}
                    onChange={(e) =>
                      setMembers((list) =>
                        list.map((item, idx) => (idx === i ? { ...item, name: e.target.value } : item)),
                      )
                    }
                  />
                  <Select
                    value={m.relation}
                    onValueChange={(v) =>
                      setMembers((list) =>
                        list.map((item, idx) =>
                          idx === i ? { ...item, relation: v as MemberItem["relation"] } : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["spouse", "father", "mother", "son", "daughter", "other"].map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1 text-xs">
                    <span>Income?</span>
                    <Switch
                      checked={m.isIncomeContributor}
                      onCheckedChange={(val) =>
                        setMembers((list) =>
                          list.map((item, idx) =>
                            idx === i ? { ...item, isIncomeContributor: val } : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Delete member"
                    onClick={() => setMembers((list) => list.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button type="submit" className="mt-4 w-full" disabled={submit.isPending}>
            {submit.isPending ? "Setting up…" : "Continue to app"}
          </Button>
        </form>
      </div>
    </div>
  );
}
