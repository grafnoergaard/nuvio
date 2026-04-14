/*
  # Add width column to home_card_config

  ## Summary
  Adds a `width` column to `home_card_config` so admins can control whether
  each card section spans the full page width or takes up half the width,
  allowing two half-width sections to sit side-by-side.

  ## Changes
  - `home_card_config`
    - New column `width` (text, default 'full') — 'full' or 'half'

  ## Notes
  - Existing rows are updated to their natural default width
  - finance_grid is always full-width (it has its own internal grid)
  - savings_investment and overview_checkup default to 'full' (they're already 2-col grids internally)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'home_card_config' AND column_name = 'width'
  ) THEN
    ALTER TABLE home_card_config ADD COLUMN width text NOT NULL DEFAULT 'full'
      CHECK (width IN ('full', 'half'));
  END IF;
END $$;

UPDATE home_card_config SET width = 'full'
WHERE card_key IN ('onboarding', 'nuvio_score', 'finance_grid', 'savings_investment', 'overview_checkup', 'savings_goals', 'consumption_status')
  AND width != 'full';

UPDATE home_card_config SET width = 'full'
WHERE card_key = 'next_step'
  AND width != 'full';
