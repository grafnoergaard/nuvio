/*
  # Create quick_expense_week_transitions table

  ## Summary
  Stores a weekly summary record for each completed week in the quick expense flow.
  This enables the week transition modal to show the user a summary of last week
  and what their budget is for the upcoming week.

  ## New Tables
  - `quick_expense_week_transitions`
    - `id` (uuid, primary key)
    - `user_id` (uuid, FK to auth.users)
    - `year` (int) - calendar year
    - `week_number` (int) - week-of-month index (1-5), scoped to the month
    - `month` (int) - calendar month (1-12)
    - `budget_amount` (numeric) - effective budget for this week (base adjusted for carry-over)
    - `total_spent` (numeric) - total spent in this week
    - `carry_over` (numeric) - positive = saved/to credit next week, negative = debt
    - `transaction_count` (int) - number of quick expenses in this week
    - `acknowledged_at` (timestamptz) - when the user dismissed the modal
    - `ai_summary` (text, nullable) - cached AI analysis for this week transition
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can only read/write their own records

  ## Notes
  - Uniqueness enforced on (user_id, year, month, week_number)
  - Each month is a closed system — carry_over does NOT affect adjacent months
  - ai_summary is nullable and cached to avoid regenerating on reload
*/

CREATE TABLE IF NOT EXISTS quick_expense_week_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL,
  week_number int NOT NULL,
  budget_amount numeric NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  carry_over numeric NOT NULL DEFAULT 0,
  transaction_count int NOT NULL DEFAULT 0,
  acknowledged_at timestamptz,
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quick_expense_week_transitions_unique UNIQUE (user_id, year, month, week_number)
);

CREATE INDEX IF NOT EXISTS idx_qewt_user_year_month ON quick_expense_week_transitions (user_id, year, month);

ALTER TABLE quick_expense_week_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own week transitions"
  ON quick_expense_week_transitions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own week transitions"
  ON quick_expense_week_transitions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own week transitions"
  ON quick_expense_week_transitions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own week transitions"
  ON quick_expense_week_transitions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
