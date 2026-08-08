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
      const user = {
        id: `usr_${Date.now()}`,
        email,
        user_metadata: { full_name: name },
      };
      setCurrentUser(user);
      return {
        data: { user, session: { user, access_token: "mock_token" } },
        error: null,
      };
    },
    async signInWithPassword({ email }: any) {
      const user = getCurrentUser() || {
        id: `usr_${Date.now()}`,
        email,
        user_metadata: { full_name: email.split("@")[0] || "User" },
      };
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
    async resetPasswordForEmail() {
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
