/*
  # Add onboarding_state to budgets

  ## Summary
  The app-shell checkup trigger references a column `onboarding_state` on the budgets table
  that was never created. This migration adds it.

  ## New Columns on `budgets`
  - `onboarding_state` (text, nullable) — tracks onboarding completion. NULL or 'complete'
    means onboarding is done. Other values indicate in-progress states.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'onboarding_state'
  ) THEN
    ALTER TABLE budgets ADD COLUMN onboarding_state text DEFAULT NULL;
  END IF;
END $$;
