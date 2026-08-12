// LocalStorage fallback client when Supabase URL is placeholder or unreachable

const STORAGE_PREFIX = "pocket_mock_db_";

function getTableData(table: string): any[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + table);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setTableData(table: string, rows: any[]) {
  try {
    localStorage.setItem(STORAGE_PREFIX + table, JSON.stringify(rows));
  } catch (e) {
    console.error("Failed to save to localStorage", e);
  }
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem("pocket_mock_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user: any) {
  if (user) {
    localStorage.setItem("pocket_mock_user", JSON.stringify(user));
  } else {
    localStorage.removeItem("pocket_mock_user");
  }
}

function getUsers(): any[] {
  try {
    const raw = localStorage.getItem("pocket_mock_users");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setUsers(users: any[]) {
  try {
    localStorage.setItem("pocket_mock_users", JSON.stringify(users));
  } catch (e) {
    console.error("Failed to save users", e);
  }
}

function stableUserId(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  }
  return `usr_${hash.toString(36)}_${email.split("@")[0].replace(/[^a-z0-9]/gi, "").slice(0, 12)}`;
}

export function getMockUserByEmail(email: string): any {
  const users = getUsers();
  return users.find((u) => u.email === email) || null;
}

class MockQueryBuilder {
  private table: string;
  private filters: ((row: any) => boolean)[] = [];
  private sortFn: ((a: any, b: any) => number) | null = null;
  private limitNum: number | null = null;
  private isInsert = false;
  private isUpdate = false;
  private isDelete = false;
  private insertData: any = null;
  private updateData: any = null;
  private returnSingle = false;
  private returnMaybeSingle = false;

  constructor(table: string) {
    this.table = table;
  }

  select(cols?: string) {
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push((r) => {
      if (val === null) return r[col] === null || r[col] === undefined;
      return r[col] === val;
    });
    return this;
  }

  gte(col: string, val: any) {
    this.filters.push((r) => r[col] >= val);
    return this;
  }

  lte(col: string, val: any) {
    this.filters.push((r) => r[col] <= val);
    return this;
  }

  ilike(col: string, pattern: string) {
    const clean = pattern.replace(/%/g, "").toLowerCase();
    this.filters.push((r) => (r[col] ? String(r[col]).toLowerCase().includes(clean) : false));
    return this;
  }

  is(col: string, val: any) {
    if (val === null) {
      this.filters.push((r) => r[col] === null || r[col] === undefined);
    } else {
      this.filters.push((r) => r[col] === val);
    }
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    const asc = opts?.ascending ?? true;
    this.sortFn = (a, b) => {
      const valA = a[col] ?? "";
      const valB = b[col] ?? "";
      if (valA < valB) return asc ? -1 : 1;
      if (valA > valB) return asc ? 1 : -1;
      return 0;
    };
    return this;
  }

  limit(n: number) {
    this.limitNum = n;
    return this;
  }

  insert(data: any) {
    this.isInsert = true;
    this.insertData = data;
    return this;
  }

  update(data: any) {
    this.isUpdate = true;
    this.updateData = data;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  single() {
    this.returnSingle = true;
    return this.execute();
  }

  maybeSingle() {
    this.returnMaybeSingle = true;
    return this.execute();
  }

  async execute(): Promise<{ data: any; error: any }> {
    let rows = getTableData(this.table);

    if (this.isInsert) {
      const items = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      const inserted = items.map((item) => ({
        id: item.id || `${this.table}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        created_at: item.created_at || new Date().toISOString(),
        ...item,
      }));
      rows = [...rows, ...inserted];
      setTableData(this.table, rows);

      const result = Array.isArray(this.insertData) ? inserted : inserted[0];
      return { data: result, error: null };
    }

    if (this.isUpdate) {
      let updatedRows: any[] = [];
      rows = rows.map((r) => {
        const matches = this.filters.every((f) => f(r));
        if (matches) {
          const updated = { ...r, ...this.updateData, updated_at: new Date().toISOString() };
          updatedRows.push(updated);
          return updated;
        }
        return r;
      });
      setTableData(this.table, rows);
      return { data: this.returnSingle ? updatedRows[0] : updatedRows, error: null };
    }

    if (this.isDelete) {
      rows = rows.filter((r) => !this.filters.every((f) => f(r)));
      setTableData(this.table, rows);
      return { data: null, error: null };
    }

    // Standard SELECT query
    let filtered = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.sortFn) {
      filtered.sort(this.sortFn);
    }
    if (this.limitNum !== null) {
      filtered = filtered.slice(0, this.limitNum);
    }

    if (this.returnSingle || this.returnMaybeSingle) {
      const item = filtered[0] ?? null;
      if (this.returnSingle && !item) {
        return { data: null, error: { message: "Row not found" } };
      }
      return { data: item, error: null };
    }

    return { data: filtered, error: null };
  }

  // Allow awaiting the builder directly
  then(onfulfilled?: (value: { data: any; error: any }) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export const createMockSupabase = () => ({
  auth: {
    async getUser() {
      const user = getCurrentUser();
      return { data: { user }, error: null };
    },
    async getSession() {
      const user = getCurrentUser();
      if (!user) return { data: { session: null }, error: null };
      return {
        data: {
          session: {
            user,
            access_token: "mock_token",
            refresh_token: "mock_refresh_token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      };
    },
    onAuthStateChange(callback: any) {
      return {
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      };
    },
    async signUp({ email, password, options }: any) {
      const name = options?.data?.full_name || email.split("@")[0] || "User";
      const users = getUsers();
      const existing = users.find((u) => u.email === email);
      if (existing) {
        return {
          data: { user: null, session: null },
          error: { message: "An account with this email already exists. Please sign in instead." },
        };
      }
      const user = {
        id: stableUserId(email),
        email,
        password,
        user_metadata: { full_name: name },
      };
      setUsers([...users, user]);
      setCurrentUser(user);
      return {
        data: { user, session: { user, access_token: "mock_token" } },
        error: null,
      };
    },
    async signInWithPassword({ email, password }: any) {
      const users = getUsers();
      const user = users.find((u) => u.email === email);
      if (!user || (password && user.password !== password)) {
        return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
      }
      setCurrentUser(user);
      return {
        data: { user, session: { user, access_token: "mock_token" } },
        error: null,
      };
    },
    async signOut() {
      setCurrentUser(null);
      return { error: null };
    },
    async signInWithOAuth() {
      return {
        data: { url: null },
        error: {
          message:
            "Google and Microsoft sign-in become active when Pocket Planner is connected to a live Supabase project. For now, use your email to sign in.",
        },
      };
    },
    async resetPasswordForEmail(email: any) {
      const users = getUsers();
      const emailStr = typeof email === "string" ? email : email?.email;
      const user = users.find((u) => u.email === emailStr);
      if (!user) {
        return { data: {}, error: { message: "There is no account registered with this email id." } };
      }
      return { data: {}, error: null };
    },
    async updateUser({ data }: any) {
      const user = getCurrentUser();
      if (user) {
        if (data?.full_name) user.user_metadata = { ...user.user_metadata, full_name: data.full_name };
        setCurrentUser(user);
      }
      return { data: { user }, error: null };
    },
  },
  from(table: string) {
    return new MockQueryBuilder(table);
  },
});
