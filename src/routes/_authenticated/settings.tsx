import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Download, History, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { bootstrapQuery } from "@/lib/queries";
import { deleteCategory, saveCategory, updateSettings } from "@/lib/pocket.functions";
import { CURRENCIES } from "@/lib/finance";
import { logAuditEvent, exportLocalBackup, restoreLocalBackup, downloadJSONFile } from "@/lib/audit-and-export";
import { isUsingMockClient } from "@/integrations/supabase/client";
import {
  getStoredMode,
  getStoredStyle,
  setMode,
  setStyle,
  THEME_STYLES,
  type ThemeMode,
  type ThemeStyle,
} from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Pocket Planner" },
      { name: "description", content: "Manage household name, cycle start day, currency and categories." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(bootstrapQuery());
  const localMode = isUsingMockClient();

  const [fullName, setFullName] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [accountType, setAccountType] = useState<"individual" | "household">("household");
  const [currency, setCurrency] = useState("INR");
  const [cycleStartDay, setCycleStartDay] = useState(1);

  const [catName, setCatName] = useState("");
  const [catEssential, setCatEssential] = useState(true);
  const [confirmCatId, setConfirmCatId] = useState<string | null>(null);
  const [themeStyle, setThemeStyle] = useState<ThemeStyle>(getStoredStyle);
  const [themeMode, setThemeMode] = useState<ThemeMode>(getStoredMode);

  useEffect(() => {
    if (!data) return;
    setFullName(data.profile?.full_name ?? "");
    setHouseholdName(data.household?.name ?? "");
    setAccountType(data.profile?.account_type ?? "household");
    setCurrency(data.profile?.currency ?? "INR");
    setCycleStartDay(data.profile?.cycle_start_day ?? 1);
  }, [data]);

  const saveProfile = useMutation({
    mutationFn: () =>
      updateSettings({
        data: {
          fullName,
          householdName,
          accountType,
          currency,
          cycleStartDay,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Settings saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCat = useMutation({
    mutationFn: () =>
      saveCategory({
        data: {
          name: catName.trim(),
          isEssential: catEssential,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Category added");
      setCatName("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCat = useMutation({
    mutationFn: (id: string) => deleteCategory({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setConfirmCatId(null);
      toast.success("Category deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Settings" subtitle="Household and account configuration">
      {isLoading || !data ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="font-display text-lg font-semibold">Household profile</h2>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sfn">Your name</Label>
                <Input
                  id="sfn"
                  value={fullName}
                  maxLength={80}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shn">Household name</Label>
                <Input
                  id="shn"
                  value={householdName}
                  maxLength={80}
                  onChange={(e) => setHouseholdName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Account mode</Label>
                <Select
                  value={accountType}
                  onValueChange={(v) => setAccountType(v as "individual" | "household")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="household">Household (multi-member)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
                          {c.code} ({c.symbol}) — {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scycleday">Payday / cycle start day</Label>
                  <Input
                    id="scycleday"
                    type="number"
                    min={1}
                    max={28}
                    value={cycleStartDay}
                    onChange={(e) => setCycleStartDay(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usually your salary credit date (e.g. 1st or 25th)
                  </p>
                </div>
              </div>

              <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
                Save changes
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="font-display text-lg font-semibold">Appearance</h2>
            <p className="mt-1 text-xs text-muted-foreground">Choose a look and how Pocket Planner handles light and dark mode on this device.</p>

            <div className="mt-4">
              <h3 className="text-sm font-medium">Design style</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {THEME_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setThemeStyle(s.id);
                      setStyle(s.id);
                      logAuditEvent("THEME_CHANGED", "SETTINGS", `Style set to ${s.id}`);
                    }}
                    aria-pressed={themeStyle === s.id}
                    className={`group rounded-xl border p-3 text-left transition-colors ${
                      themeStyle === s.id
                        ? "border-primary bg-primary/10"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {s.preview.map((c) => (
                        <span
                          key={c}
                          className="size-4 rounded-full ring-1 ring-black/10"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="mt-2 text-sm font-semibold">{s.name}</div>
                    <div className="mt-0.5 text-xs leading-snug text-muted-foreground">
                      {s.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-medium">Mode</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                {(["light", "dark", "system"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setThemeMode(t);
                      setMode(t);
                      logAuditEvent("THEME_CHANGED", "SETTINGS", `Mode set to ${t}`);
                    }}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium capitalize transition-colors ${
                      themeMode === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="font-display text-lg font-semibold">Categories</h2>            <div className="mt-4 flex flex-wrap items-end gap-2">
              <div className="min-w-44 flex-1 space-y-1">
                <Label htmlFor="newcat">New category</Label>
                <Input
                  id="newcat"
                  value={catName}
                  maxLength={40}
                  placeholder="e.g. Health"
                  onChange={(e) => setCatName(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <span>Essential</span>
                <Switch checked={catEssential} onCheckedChange={setCatEssential} />
              </label>
              <Button onClick={() => addCat.mutate()} disabled={!catName.trim() || addCat.isPending}>
                <Plus className="size-4" /> Add
              </Button>
            </div>

            <ul className="mt-5 divide-y border-t pt-2">
              {data.categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    {c.name}
                    {c.is_essential && (
                      <span className="ml-2 text-xs text-muted-foreground">essential</span>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete category"
                    onClick={() => setConfirmCatId(c.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
            <h2 className="font-display text-lg font-semibold">Data backup & recovery</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {localMode
                ? "This app is running in local/demo mode — data is stored in this browser. Export a backup file to keep your records, and import it to restore them on another browser or after clearing data."
                : "This app is connected to a Supabase cloud project. Your data is stored securely in the cloud and is never lost when you close the browser. Manage users and data from your Supabase dashboard."}
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Upload className="size-4 text-primary" /> Export data
                </h3>
                <p className="text-xs text-muted-foreground">
                  {localMode
                    ? "Download all your records (household, members, categories, transactions, budgets, bills, goals) as a JSON backup file."
                    : "Download a JSON snapshot of your current dashboard state."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (localMode) {
                      exportLocalBackup();
                      logAuditEvent("EXPORT_BACKUP", "SECURITY", "Exported full local backup file");
                    } else {
                      downloadJSONFile(data ?? {}, `pocket_planner_snapshot_${new Date().toISOString().slice(0, 10)}.json`);
                      logAuditEvent("EXPORT_BACKUP", "SECURITY", "Exported dashboard snapshot");
                    }
                    toast.success("Backup file downloaded");
                  }}
                >
                  <Download className="size-4" /> Download backup
                </Button>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <History className="size-4 text-primary" /> Restore backup
                </h3>
                <p className="text-xs text-muted-foreground">
                  {localMode
                    ? "Import a previously exported Pocket Planner backup file to restore your records."
                    : "Cloud-stored data is restored automatically when you sign in — no manual restore needed."}
                </p>
                {localMode ? (
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted">
                    Choose JSON File
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            try {
                              const parsed = JSON.parse(event.target?.result as string);
                              const result = restoreLocalBackup(parsed);
                              if (result.ok) {
                                logAuditEvent("RESTORE_DATA", "SECURITY", `Restored backup from ${file.name}`);
                                queryClient.clear();
                                window.location.href = "/";
                                toast.success(result.message);
                              } else {
                                toast.error(result.message);
                              }
                            } catch {
                              toast.error("Failed to parse JSON backup file");
                            }
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                ) : (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-emerald-600" /> Managed by Supabase
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl border bg-muted/20 p-4 space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600" /> Security & data storage status
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Storage location</span>
                  <span className="font-semibold text-emerald-600">
                    {localMode ? "This browser only (local)" : "Supabase cloud (PostgreSQL)"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Authentication</span>
                  <span className="font-semibold text-emerald-600">
                    {localMode ? "Local demo session" : "Supabase Auth (email + password)"}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Data persistence</span>
                  <span className="font-semibold text-emerald-600">
                    {localMode ? "Not persistent across devices" : "Persistent cloud storage"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <ConfirmDialog
            open={confirmCatId !== null}
            onOpenChange={(v) => {
              if (!v) setConfirmCatId(null);
            }}
            title="Delete this category?"
            description="Past expenses in this category will move to Uncategorised, and any budget set for it will be removed. This cannot be undone."
            confirmLabel="Delete category"
            loading={removeCat.isPending}
            onConfirm={() => {
              if (confirmCatId) removeCat.mutate(confirmCatId);
            }}
          />
        </div>
      )}
    </AppShell>
  );
}
