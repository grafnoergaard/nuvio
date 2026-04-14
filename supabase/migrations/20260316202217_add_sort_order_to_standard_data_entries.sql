/*
  # Add sort_order to standard_data_entries

  ## Summary
  Adds a `sort_order` integer column to `standard_data_entries` to allow
  admin-controlled display ordering within each section.

  ## Changes
  - New column `sort_order` (integer, default 0) on `standard_data_entries`
  - Index on (version_id, section, sort_order) for efficient ordered queries
  - Sets explicit sort_order for all nuvio_flow entries, grouped by status
    tier (worst → best) and sub-grouped by type within each tier:
    1. Over budget     (100–199)
    2. Stram op        (200–299)
    3. Hold kursen     (300–399)
    4. Godt tempo      (400–499)
    5. Nuvio Flow      (500–599)
    Within each tier: threshold (x10), badge (x20), headline (x30), color (x40+)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'standard_data_entries' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE public.standard_data_entries ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_standard_data_entries_sort
  ON public.standard_data_entries (version_id, section, sort_order);

-- Assign sort_order for nuvio_flow entries grouped worst → best
UPDATE public.standard_data_entries SET sort_order = CASE key
  -- Over budget (tier 1)
  WHEN 'FLOW_STATUS_OVER_BUDGET_USED_PCT' THEN 110
  WHEN 'FLOW_BADGE_OVER'                  THEN 120
  WHEN 'FLOW_HEADLINE_OVER'               THEN 130
  WHEN 'FLOW_COLOR_OVER_BADGE'            THEN 140
  WHEN 'FLOW_COLOR_OVER_CARD'             THEN 141

  -- Stram op (tier 2)
  WHEN 'FLOW_STATUS_WARN_USED_PCT'        THEN 210
  WHEN 'FLOW_STATUS_WARN_HEALTH_MIN'      THEN 211
  WHEN 'FLOW_BADGE_WARN'                  THEN 220
  WHEN 'FLOW_HEADLINE_WARN'               THEN 230
  WHEN 'FLOW_COLOR_WARN_BADGE'            THEN 240
  WHEN 'FLOW_COLOR_WARN_CARD'             THEN 241

  -- Hold kursen (tier 3)
  WHEN 'FLOW_STATUS_KURSEN_HEALTH_MIN'    THEN 310
  WHEN 'FLOW_BADGE_KURSEN'               THEN 320
  WHEN 'FLOW_HEADLINE_KURSEN'            THEN 330
  WHEN 'FLOW_COLOR_KURSEN_BADGE'         THEN 340
  WHEN 'FLOW_COLOR_GOOD_CARD'            THEN 341

  -- Godt tempo (tier 4)
  WHEN 'FLOW_STATUS_TEMPO_HEALTH_MIN'     THEN 410
  WHEN 'FLOW_BADGE_TEMPO'                THEN 420
  WHEN 'FLOW_HEADLINE_TEMPO'             THEN 430
  WHEN 'FLOW_COLOR_TEMPO_BADGE'          THEN 440

  -- Nuvio Flow (tier 5)
  WHEN 'FLOW_STATUS_FLOW_HEALTH_MIN'      THEN 510
  WHEN 'FLOW_STATUS_FLOW_USED_MAX'        THEN 511
  WHEN 'FLOW_BADGE_FLOW'                  THEN 520
  WHEN 'FLOW_HEADLINE_FLOW'               THEN 530
  WHEN 'FLOW_COLOR_FLOW_CARD'             THEN 541

  -- Also handle the score threshold entry already in the section
  WHEN 'NUVIO_FLOW_SCORE_PERFECT_THRESHOLD' THEN 599

  ELSE 0
END
WHERE section = 'nuvio_flow';
