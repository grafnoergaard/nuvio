/*
  # Add cumulative_score to quick_expense_streaks

  ## Summary
  Extends the streak table with a cumulative Nuvio Flow Score that grows over time
  based on monthly budget performance.

  ## Changes to quick_expense_streaks
  - `cumulative_score` (integer, default 0): The user's all-time accumulated Nuvio Flow
    Score. Grows by 0–15 points per on-budget month based on performance (graduated
    reward), and takes a fixed -30 point penalty when the budget is exceeded (binary
    punishment). The score has a floor of 0 — it can never go negative.

  ## Scoring Model
  - Graduated monthly reward: 0–15 points based on how well the budget was respected
    (the exact amount is calculated in application logic using the flow score 0–100).
  - Binary penalty on overage: -30 points (2× the max monthly reward of 15), floor 0.
  - No ceiling — the score grows indefinitely.

  ## Security
  - Inherits existing RLS policies from the table (users can only read/write their own row).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quick_expense_streaks' AND column_name = 'cumulative_score'
  ) THEN
    ALTER TABLE quick_expense_streaks ADD COLUMN cumulative_score integer NOT NULL DEFAULT 0;
  END IF;
END $$;
