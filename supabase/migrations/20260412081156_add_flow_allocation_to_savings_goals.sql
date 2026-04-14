/*
  # Add Flow Allocation to Savings Goals

  ## Summary
  Adds two new columns to the `savings_goals` table to support visually allocating
  Flow savings balance and monthly Flow surplus to individual savings goals.

  ## Changes

  ### Modified Table: `savings_goals`
  - `flow_allocation_pct` (numeric, default 0) — percentage of monthly Flow surplus allocated to this goal (0-100)
  - `flow_allocation_amount` (numeric, default 0) — visual allocation from current Flow balance to this goal (display only, not deducted)

  ## Notes
  1. Both columns are purely display/informational — no money is moved
  2. The sum of flow_allocation_pct across all a user's goals should not exceed 100%
     (enforced in the frontend, not at the DB level for flexibility)
  3. Both default to 0 so existing goals are unaffected
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'savings_goals' AND column_name = 'flow_allocation_pct'
  ) THEN
    ALTER TABLE savings_goals ADD COLUMN flow_allocation_pct numeric DEFAULT 0 NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'savings_goals' AND column_name = 'flow_allocation_amount'
  ) THEN
    ALTER TABLE savings_goals ADD COLUMN flow_allocation_amount numeric DEFAULT 0 NOT NULL;
  END IF;
END $$;
