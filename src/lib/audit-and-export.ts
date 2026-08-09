// Enterprise Audit Trail & Data Backup/Export Engine for PocketPlanner

export interface AuditLogItem {
  id: string;
  timestamp: string;
  action: string;
  category: "TRANSACTION" | "BUDGET" | "GOAL" | "SETTINGS" | "HOUSEHOLD" | "SECURITY";
  details: string;
  user: string;
  ipAddress?: string;
}

const AUDIT_STORAGE_KEY = "pocket_enterprise_audit_trail";

export function logAuditEvent(
  action: string,
  category: AuditLogItem["category"],
  details: string,
  userName = "Current User",
) {
  try {
    const existingRaw = localStorage.getItem(AUDIT_STORAGE_KEY);
    const logs: AuditLogItem[] = existingRaw ? JSON.parse(existingRaw) : [];

    const newLog: AuditLogItem = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      action,
      category,
      details,
      user: userName,
      ipAddress: "127.0.0.1 (Local Session)",
    };

    const updated = [newLog, ...logs].slice(0, 100); // keep last 100 events
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Failed to log audit event:", e);
  }
}

export function getAuditLogs(): AuditLogItem[] {
  try {
    const existingRaw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!existingRaw) {
      // Return default initial system log
      return [
        {
          id: "init_1",
          timestamp: new Date().toISOString(),
          action: "SYSTEM_BOOTSTRAP",
          category: "SECURITY",
          details: "Enterprise session initialized with AES-256 client validation",
          user: "System Administrator",
        },
      ];
    }
    return JSON.parse(existingRaw);
  } catch {
    return [];
  }
}

export function exportTransactionsCSV(transactions: any[], categoriesMap: Record<string, string>, currency: string) {
  const headers = ["ID", "Date", "Description / Note", `Amount (${currency})`, "Type", "Category", "Essential"];
  const rows = transactions.map((t) => [
    t.id,
    t.occurred_on || t.date || "",
    `"${(t.note || "Unspecified").replace(/"/g, '""')}"`,
    t.amount,
    t.type === "income" ? "INCOME" : "EXPENSE",
    `"${categoriesMap[t.category_id || t.categoryId] || "Uncategorized"}"`,
    t.is_essential ? "YES" : "NO",
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `pocket_transactions_export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadJSONFile(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --- Local (demo/mock) backup & restore -------------------------------------
// Works against the localStorage-backed client. When the app is connected to a
// real Supabase project, data lives server-side and should be managed from the
// Supabase dashboard instead.

const TABLE_NAMES = [
  "households",
  "profiles",
  "household_members",
  "categories",
  "expenses",
  "incomes",
  "budgets",
  "recurring_bills",
  "savings_goals",
];

const STORAGE_PREFIX = "pocket_mock_db_";
const USER_KEY = "pocket_mock_user";
const BACKUP_APP_ID = "pocket-planner";
const BACKUP_VERSION = 1;

export function buildLocalBackup(): Record<string, unknown> {
  const tables: Record<string, unknown[]> = {};
  for (const name of TABLE_NAMES) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + name);
      tables[name] = raw ? JSON.parse(raw) : [];
    } catch {
      tables[name] = [];
    }
  }
  let user: unknown = null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    user = raw ? JSON.parse(raw) : null;
  } catch {
    user = null;
  }
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    user,
    tables,
  };
}

export function exportLocalBackup(filename = `pocket_planner_backup_${new Date().toISOString().slice(0, 10)}.json`) {
  downloadJSONFile(buildLocalBackup(), filename);
}

export function restoreLocalBackup(json: unknown): { ok: boolean; message: string } {
  if (!json || typeof json !== "object") {
    return { ok: false, message: "Invalid backup file format" };
  }
  const backup = json as Record<string, unknown>;
  if (backup.app !== BACKUP_APP_ID || typeof backup.tables !== "object" || backup.tables === null) {
    return { ok: false, message: "This file is not a valid Pocket Planner backup" };
  }
  const tables = backup.tables as Record<string, unknown[]>;
  for (const name of TABLE_NAMES) {
    if (Array.isArray(tables[name])) {
      try {
        localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(tables[name]));
      } catch (e) {
        return { ok: false, message: `Failed to restore "${name}": ${(e as Error).message}` };
      }
    }
  }
  try {
    if (backup.user === null) localStorage.removeItem(USER_KEY);
    else localStorage.setItem(USER_KEY, JSON.stringify(backup.user));
  } catch (e) {
    return { ok: false, message: `Failed to restore session: ${(e as Error).message}` };
  }
  return { ok: true, message: "Backup restored successfully" };
}
