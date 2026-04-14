/*
  # Add is_active flag to budgets

  ## Summary
  Adds an `is_active` boolean column to the `budgets` table.
  Only one budget can be active at a time. The active budget is the one
  shown across all dashboards and summary views.

  ## Changes
  - `budgets.is_active` (boolean, default false) – marks the budget used in dashboards

  ## Notes
  - Existing budgets all default to false
  - A database function `set_active_budget(budget_uuid)` ensures only one budget
    is active at a time by resetting all others before setting the chosen one
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE budgets ADD COLUMN is_active boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION set_active_budget(budget_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE budgets SET is_active = false WHERE is_active = true;
  UPDATE budgets SET is_active = true WHERE id = budget_uuid;
END;
$$;
