/*
  # Add onboarding state to budgets

  ## Summary
  Extends the budgets table with plan_state fields that power the onboarding engine.
  This becomes the single source of truth for what step the user is on.

  ## New Columns on `budgets`
  - `onboarding_dismissed` (boolean, default false) — user has actively skipped onboarding
  - `has_variable_budget` (boolean, default false) — user has set a variable expense estimate

  ## Notes
  - `has_income` and `has_fixed_expenses` are derived live from budget_plans + category_groups
    and do NOT need to be stored (they reflect real data)
  - `has_variable_budget` DOES need storage because variable estimates live on household,
    not per-budget; this flag tracks if the user completed the variable step for THIS budget
  - `onboarding_dismissed` lets users skip without losing their progress tracking
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'onboarding_dismissed'
  ) THEN
    ALTER TABLE budgets ADD COLUMN onboarding_dismissed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'has_variable_budget'
  ) THEN
    ALTER TABLE budgets ADD COLUMN has_variable_budget boolean NOT NULL DEFAULT false;
  END IF;
END $$;
