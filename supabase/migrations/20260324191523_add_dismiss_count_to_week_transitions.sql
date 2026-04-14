/*
  # Add dismiss_count to quick_expense_week_transitions

  ## Summary
  Adds a dismiss_count column to track how many times a user has dismissed
  the week transition wizard without completing it.

  ## Changes
  - `quick_expense_week_transitions` table:
    - New column: `dismiss_count` (integer, default 0) — tracks number of dismissals

  ## Purpose
  - First dismissal shows "Ikke nu" button
  - Second+ dismissal shows "Vis ikke igen" button (permanent dismiss = sets acknowledged_at)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quick_expense_week_transitions'
    AND column_name = 'dismiss_count'
  ) THEN
    ALTER TABLE quick_expense_week_transitions
    ADD COLUMN dismiss_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;
