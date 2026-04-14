/*
  # Add weekly carry-over to monthly budgets

  ## Summary
  Implements the weekly budget carry-over logic for Nuvio Flow.

  ## Logic
  - The weekly base budget = (monthly_budget / days_in_month) * 7
  - Each week is evaluated independently
  - If a week's spending EXCEEDS the weekly base, the excess is a carry-over debt
    that reduces the available budget for remaining weeks in the same month
  - If a week's spending is UNDER the weekly base, there is NO benefit to the next week
    (no positive carry-over — you cannot "save up" for future weeks)
  - The carry-over resets to 0 at the start of each new month

  ## New Columns on quick_expense_monthly_budgets
  - `weekly_carry_over` (numeric, default 0): Accumulated deficit from weeks where
    spending exceeded the weekly base. Always <= 0. Resets each month.
  - `last_carry_over_updated_at` (timestamptz): When carry-over was last recalculated.

  ## Security
  No RLS changes needed — existing policies on quick_expense_monthly_budgets cover these columns.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quick_expense_monthly_budgets' AND column_name = 'weekly_carry_over'
  ) THEN
    ALTER TABLE quick_expense_monthly_budgets
      ADD COLUMN weekly_carry_over numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quick_expense_monthly_budgets' AND column_name = 'last_carry_over_updated_at'
  ) THEN
    ALTER TABLE quick_expense_monthly_budgets
      ADD COLUMN last_carry_over_updated_at timestamptz;
  END IF;
END $$;
