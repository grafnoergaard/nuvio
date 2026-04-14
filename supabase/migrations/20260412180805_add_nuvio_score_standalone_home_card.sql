/*
  # Add Nuvio Score Standalone Home Card

  ## Summary
  Inserts a new home card config entry for the standalone Nuvio Score card
  (`nuvio_score_standalone`) on the overview page. This card shows the
  cumulative streak-based score (from quick_expense_streaks) as a full-size
  card comparable to the Flow Savings card, including a tier progress bar
  and streak info.

  ## Changes
  - New row in `home_card_config` with card_key = 'nuvio_score_standalone'
  - Default: visible, full width, sort_order = 25 (between nuvio_score=20 and finance_grid=30)
  - The existing 'nuvio_score' card (the calculated 0-100 score) is left untouched
*/

INSERT INTO home_card_config (card_key, label, is_visible, sort_order, width)
SELECT 'nuvio_score_standalone', 'Nuvio Score (streak)', true, 25, 'full'
WHERE NOT EXISTS (
  SELECT 1 FROM home_card_config WHERE card_key = 'nuvio_score_standalone'
);
