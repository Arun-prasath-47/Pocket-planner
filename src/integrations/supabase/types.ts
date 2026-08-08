export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      budgets: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          household_id: string
          id: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          household_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          household_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          household_id: string
          icon: string
          id: string
          is_essential: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          household_id: string
          icon?: string
          id?: string
          is_essential?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          household_id?: string
          icon?: string
          id?: string
          is_essential?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          beneficiary_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          household_id: string
          id: string
          is_essential: boolean
          is_shared: boolean
          note: string | null
          occurred_on: string
          payment_type: string
          spender_id: string | null
        }
        Insert: {
          amount: number
          beneficiary_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          household_id: string
          id?: string
          is_essential?: boolean
          is_shared?: boolean
          note?: string | null
          occurred_on?: string
          payment_type?: string
          spender_id?: string | null
        }
        Update: {
          amount?: number
          beneficiary_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          household_id?: string
          id?: string
          is_essential?: boolean
          is_shared?: boolean
          note?: string | null
          occurred_on?: string
          payment_type?: string
          spender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_spender_id_fkey"
            columns: ["spender_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          color: string
          created_at: string
          household_id: string
          id: string
          is_income_contributor: boolean
          name: string
          relation: Database["public"]["Enums"]["member_relation"]
          user_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          household_id: string
          id?: string
          is_income_contributor?: boolean
          name: string
          relation?: Database["public"]["Enums"]["member_relation"]
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          household_id?: string
          id?: string
          is_income_contributor?: boolean
          name?: string
          relation?: Database["public"]["Enums"]["member_relation"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      incomes: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          frequency: Database["public"]["Enums"]["income_frequency"]
          household_id: string
          id: string
          member_id: string | null
          note: string | null
          occurred_on: string
          source: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["income_frequency"]
          household_id: string
          id?: string
          member_id?: string | null
          note?: string | null
          occurred_on?: string
          source?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          frequency?: Database["public"]["Enums"]["income_frequency"]
          household_id?: string
          id?: string
          member_id?: string | null
          note?: string | null
          occurred_on?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "household_members"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          created_at: string
          currency: string
          cycle_start_day: number
          email: string | null
          full_name: string
          household_id: string | null
          id: string
          onboarded: boolean
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string
          currency?: string
          cycle_start_day?: number
          email?: string | null
          full_name?: string
          household_id?: string | null
          id: string
          onboarded?: boolean
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string
          currency?: string
          cycle_start_day?: number
          email?: string | null
          full_name?: string
          household_id?: string | null
          id?: string
          onboarded?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_bills: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          due_day: number
          household_id: string
          id: string
          is_active: boolean
          last_paid_on: string | null
          name: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          due_day?: number
          household_id: string
          id?: string
          is_active?: boolean
          last_paid_on?: string | null
          name: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          due_day?: number
          household_id?: string
          id?: string
          is_active?: boolean
          last_paid_on?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_bills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_bills_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          created_at: string
          household_id: string
          id: string
          name: string
          saved_amount: number
          target_amount: number
          target_date: string | null
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          name: string
          saved_amount?: number
          target_amount: number
          target_date?: string | null
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          saved_amount?: number
          target_amount?: number
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "savings_goals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_type: "individual" | "household"
      income_frequency: "monthly" | "weekly" | "biweekly" | "irregular"
      member_relation:
        | "self"
        | "father"
        | "mother"
        | "son"
        | "daughter"
        | "spouse"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
