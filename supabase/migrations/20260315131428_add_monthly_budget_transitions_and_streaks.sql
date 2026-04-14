/*
  # Monthly Budget Transitions and Streak Tracking

  ## Summary
  Extends the Hurtig Udgift (quick expense) feature with:
  - Per-month budget amounts so each month can have a different discretionary budget
  - A transition acknowledgment log so the app knows when a user has been prompted for a new month
  - A streak tracking table to gamify consecutive on-budget months

  ## New Tables

  ### quick_expense_monthly_budgets
  Stores the discretionary budget amount for each specific year+month combo per user.
  Replaces the single-row quick_expense_budgets for per-month support.
  - user_id: FK to auth.users
  - year: calendar year (e.g. 2026)
  - month: 1–12
  - budget_amount: the monthly discretionary budget in DKK
  - created_at / updated_at: timestamps

  ### quick_expense_month_transitions
  Records when a user acknowledged the monthly transition prompt.
  Used to determine whether to show the prompt again.
  - user_id: FK to auth.users
  - year + month: the NEW month being transitioned into
  - prev_year + prev_month: the previous month being summarized
  - acknowledged_at: when the user dismissed/confirmed the prompt

  ### quick_expense_streaks
  Tracks gamification state: consecutive months within budget.
  - user_id: FK to auth.users (unique — one row per user)
  - current_streak: number of consecutive on-budget months
  - longest_streak: all-time record
  - last_evaluated_year / last_evaluated_month: which month was last counted
  - updated_at

  ## Security
  - RLS enabled on all three tables
  - Users can only read/write their own rows
*/

-- Monthly budget per year+month
CREATE TABLE IF NOT EXISTS quick_expense_monthly_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year >= 2020 AND year <= 2100),
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  budget_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (budget_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_qemb_user_year_month ON quick_expense_monthly_budgets (user_id, year, month);

ALTER TABLE quick_expense_monthly_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own monthly budgets"
  ON quick_expense_monthly_budgets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monthly budgets"
  ON quick_expense_monthly_budgets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monthly budgets"
  ON quick_expense_monthly_budgets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own monthly budgets"
  ON quick_expense_monthly_budgets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Month transition acknowledgment log
CREATE TABLE IF NOT EXISTS quick_expense_month_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  prev_year integer NOT NULL,
  prev_month integer NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_qemt_user_year_month ON quick_expense_month_transitions (user_id, year, month);

ALTER TABLE quick_expense_month_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own transitions"
  ON quick_expense_month_transitions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transitions"
  ON quick_expense_month_transitions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transitions"
  ON quick_expense_month_transitions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Streak tracking
CREATE TABLE IF NOT EXISTS quick_expense_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_evaluated_year integer,
  last_evaluated_month integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qes_user ON quick_expense_streaks (user_id);

ALTER TABLE quick_expense_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own streak"
  ON quick_expense_streaks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streak"
  ON quick_expense_streaks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own streak"
  ON quick_expense_streaks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
