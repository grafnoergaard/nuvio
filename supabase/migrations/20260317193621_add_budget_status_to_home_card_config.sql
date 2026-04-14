/*
  # Add budget_status card to home_card_config

  ## Summary
  Inserts a new row for the Budget Status Card (from /nuvio-flow) into the
  home_card_config table so it can be enabled on the home overview page.

  ## Changes
  - Inserts `budget_status` card entry with:
    - label: 'Budget Status'
    - is_visible: false (opt-in, hidden by default)
    - sort_order: 90 (after existing cards)
    - width: 'full'

  ## Notes
  - Only inserts if the row does not already exist (safe to run multiple times)
*/

INSERT INTO home_card_config (card_key, label, is_visible, sort_order, width)
SELECT 'budget_status', 'Budget Status', false, 90, 'full'
WHERE NOT EXISTS (
  SELECT 1 FROM home_card_config WHERE card_key = 'budget_status'
);
