export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      budgets: {
        Row: {
          id: string
          name: string
          year: number
          start_month: number
          end_month: number
          is_active: boolean
          opening_balance: number
          onboarding_dismissed: boolean
          has_variable_budget: boolean
          last_checkup_at: string | null
          checkup_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          year: number
          start_month?: number
          end_month?: number
          is_active?: boolean
          opening_balance?: number
          onboarding_dismissed?: boolean
          has_variable_budget?: boolean
          last_checkup_at?: string | null
          checkup_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          year?: number
          start_month?: number
          end_month?: number
          is_active?: boolean
          opening_balance?: number
          onboarding_dismissed?: boolean
          has_variable_budget?: boolean
          last_checkup_at?: string | null
          checkup_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      category_groups: {
        Row: {
          id: string
          name: string
          is_income: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          is_income?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          is_income?: boolean
          created_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          category_group_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          category_group_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          category_group_id?: string
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          budget_id: string
          date: string
          amount: string
          description: string
          recipient_name: string | null
          recipient_id: string | null
          category_group_id: string | null
          category_id: string | null
          sent_to_budget: boolean
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          budget_id: string
          date: string
          amount: string | number
          description: string
          recipient_name?: string | null
          recipient_id?: string | null
          category_group_id?: string | null
          category_id?: string | null
          sent_to_budget?: boolean
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          budget_id?: string
          date?: string
          amount?: string | number
          description?: string
          recipient_name?: string | null
          recipient_id?: string | null
          category_group_id?: string | null
          category_id?: string | null
          sent_to_budget?: boolean
          sent_at?: string | null
          created_at?: string
        }
      }
      merchant_rules: {
        Row: {
          id: string
          budget_id: string | null
          text_match: string
          amount_match: string | null
          recipient_name: string
          created_at: string
        }
        Insert: {
          id?: string
          budget_id?: string | null
          text_match: string
          amount_match?: string | number | null
          recipient_name: string
          created_at?: string
        }
        Update: {
          id?: string
          budget_id?: string | null
          text_match?: string
          amount_match?: string | number | null
          recipient_name?: string
          created_at?: string
        }
      }
      budget_lines: {
        Row: {
          id: string
          budget_id: string
          category_id: string
          amount_planned: string
          created_at: string
        }
        Insert: {
          id?: string
          budget_id: string
          category_id: string
          amount_planned: string | number
          created_at?: string
        }
        Update: {
          id?: string
          budget_id?: string
          category_id?: string
          amount_planned?: string | number
          created_at?: string
        }
      }
      recipients: {
        Row: {
          id: string
          name: string
          default_category_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          default_category_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          default_category_id?: string | null
          created_at?: string
        }
      }
      recipient_rules: {
        Row: {
          id: string
          text_match: string
          match_type: 'exact' | 'contains'
          amount_match: string | null
          recipient_id: string
          priority: number
          created_at: string
        }
        Insert: {
          id?: string
          text_match: string
          match_type?: 'exact' | 'contains'
          amount_match?: string | number | null
          recipient_id: string
          priority?: number
          created_at?: string
        }
        Update: {
          id?: string
          text_match?: string
          match_type?: 'exact' | 'contains'
          amount_match?: string | number | null
          recipient_id?: string
          priority?: number
          created_at?: string
        }
      }
      budget_plans: {
        Row: {
          id: string
          budget_id: string
          recipient_id: string
          month: number
          amount_planned: string
          created_at: string
        }
        Insert: {
          id?: string
          budget_id: string
          recipient_id: string
          month: number
          amount_planned?: string | number
          created_at?: string
        }
        Update: {
          id?: string
          budget_id?: string
          recipient_id?: string
          month?: number
          amount_planned?: string | number
          created_at?: string
        }
      }
      savings_goals: {
        Row: {
          id: string
          name: string
          description: string | null
          target_amount: number
          current_amount: number
          monthly_contribution: number | null
          emoji: string | null
          color: string | null
          completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          target_amount: number
          current_amount?: number
          monthly_contribution?: number | null
          emoji?: string | null
          color?: string | null
          completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          target_amount?: number
          current_amount?: number
          monthly_contribution?: number | null
          emoji?: string | null
          color?: string | null
          completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      nav_groups: {
        Row: {
          id: string
          name: string
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      nav_items: {
        Row: {
          id: string
          name: string
          href: string
          icon_name: string
          group_id: string | null
          sort_order: number
          is_system: boolean
          is_visible_to_users: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          href: string
          icon_name: string
          group_id?: string | null
          sort_order?: number
          is_system?: boolean
          is_visible_to_users?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          href?: string
          icon_name?: string
          group_id?: string | null
          sort_order?: number
          is_system?: boolean
          is_visible_to_users?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      mobile_nav_slots: {
        Row: {
          id: string
          position: number
          nav_item_id: string | null
          is_burger: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          position: number
          nav_item_id?: string | null
          is_burger?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          position?: number
          nav_item_id?: string | null
          is_burger?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

export type Budget = Database['public']['Tables']['budgets']['Row']
export type BudgetInsert = Database['public']['Tables']['budgets']['Insert']
export type BudgetUpdate = Database['public']['Tables']['budgets']['Update']
export type CategoryGroup = Database['public']['Tables']['category_groups']['Row']
export type Category = Database['public']['Tables']['categories']['Row']
export type Transaction = Database['public']['Tables']['transactions']['Row']
export type BudgetLine = Database['public']['Tables']['budget_lines']['Row']
export type MerchantRule = Database['public']['Tables']['merchant_rules']['Row']
export type Recipient = Database['public']['Tables']['recipients']['Row']
export type RecipientRule = Database['public']['Tables']['recipient_rules']['Row']
export type BudgetPlan = Database['public']['Tables']['budget_plans']['Row']
export type BudgetPlanInsert = Database['public']['Tables']['budget_plans']['Insert']

export interface CategoryWithGroup extends Category {
  category_group?: CategoryGroup
}

export interface TransactionWithDetails extends Transaction {
  category?: Category
  category_group?: CategoryGroup
  recipient?: Recipient
}

export interface BudgetLineWithCategory extends BudgetLine {
  category?: CategoryWithGroup
}

export interface RecipientWithCategory extends Recipient {
  default_category?: CategoryWithGroup
}

export interface BudgetPlanWithRecipient extends BudgetPlan {
  recipient?: RecipientWithCategory
}

export type SavingsGoal = Database['public']['Tables']['savings_goals']['Row']

export type NavGroup = Database['public']['Tables']['nav_groups']['Row']
export type NavItem = Database['public']['Tables']['nav_items']['Row']
export type MobileNavSlot = Database['public']['Tables']['mobile_nav_slots']['Row']

export interface NavGroupWithItems extends NavGroup {
  items: NavItem[]
}

export interface MobileNavSlotWithItem extends MobileNavSlot {
  nav_item: NavItem | null
}
