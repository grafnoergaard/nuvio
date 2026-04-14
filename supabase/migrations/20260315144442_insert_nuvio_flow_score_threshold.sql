/*
  # Insert Nuvio Flow Score Perfect Threshold into standard_data_entries

  ## Summary
  Adds a configurable threshold for the Nuvio Flow Score calculation.
  A score of 100 is achieved when the user is exactly this percentage under budget.

  ## New Entry
  - Key: `NUVIO_FLOW_SCORE_PERFECT_THRESHOLD`
  - Value: 0.15 (15% — meaning spending 85% of budget = score of 100)
  - Section: nuvio_flow
  - Unit: ratio (0–1)

  ## Notes
  - Admins can adjust this from /admin/standard-data
  - Scores above 100 are possible if the user spends less than (1 - threshold) of budget
*/

INSERT INTO public.standard_data_entries (
  version_id,
  section,
  key,
  value_numeric,
  value_text,
  unit,
  label,
  notes,
  requires_admin_value
)
SELECT
  id,
  'nuvio_flow',
  'NUVIO_FLOW_SCORE_PERFECT_THRESHOLD',
  0.15,
  NULL,
  'ratio',
  'Nuvio Flow Score — perfekt grænse (andel under budget)',
  'Score på 100 opnås når brugeren er præcis denne andel under budget. Standard: 0.15 = 15% under budget.',
  false
FROM public.standard_data_versions
WHERE is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.standard_data_entries
    WHERE key = 'NUVIO_FLOW_SCORE_PERFECT_THRESHOLD'
  )
ORDER BY valid_from DESC
LIMIT 1;
