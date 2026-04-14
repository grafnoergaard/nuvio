/*
  # Add Flow Savings Card to Home Card Config

  ## Summary
  Inserts a new home card entry for the Flow Savings card.

  ## New Entry
  - `card_key`: 'flow_savings'
  - `label`: 'Flow Opsparing'
  - `is_visible`: true (shown by default)
  - `sort_order`: 25 — positioned immediately after the Nuvio Flow / Budget Status card (sort_order 20)
  - `width`: 'full'
*/

INSERT INTO home_card_config (card_key, label, is_visible, sort_order, width)
VALUES ('flow_savings', 'Flow Opsparing', true, 25, 'full')
ON CONFLICT (card_key) DO NOTHING;
