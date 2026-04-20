/*
  # Add variable expense category default amounts to standard data

  ## Summary
  The active standard_data_version has valid_to = 2025-12-31 which is in the past.
  This migration extends the version's validity and inserts the five variable
  expense category default amounts into the active standard data version.

  ## New Standard Data Keys (section: VARIABELT_FORBRUG)
  - VAR_FOOD_MONTHLY       – Mad & dagligvarer: 3.000 kr./md.
  - VAR_TRANSPORT_MONTHLY  – Transport: 1.200 kr./md.
  - VAR_CAFE_MONTHLY       – Café & takeaway: 600 kr./md.
  - VAR_LEISURE_MONTHLY    – Fritid & underholdning: 700 kr./md.
  - VAR_MISC_MONTHLY       – Diverse: 800 kr./md.

  ## Notes
  - Also extends the active version's valid_to to 2099-12-31 so future
    date-based lookups keep working without manual maintenance.
*/

UPDATE standard_data_versions
SET valid_to = '2099-12-31'
WHERE version = '2025.1'
  AND is_active = true;

INSERT INTO standard_data_entries (version_id, section, key, value_numeric, value_text, unit, label, notes, requires_admin_value)
SELECT
  v.id,
  'VARIABELT_FORBRUG',
  e.key,
  e.value_numeric,
  NULL,
  'kr/md',
  e.label,
  e.notes,
  false
FROM (VALUES
  ('VAR_FOOD_MONTHLY',      3000, 'Mad & dagligvarer',      'Standardbeløb pr. måned foreslået i onboarding-wizarden'),
  ('VAR_TRANSPORT_MONTHLY', 1200, 'Transport',              'Standardbeløb pr. måned foreslået i onboarding-wizarden'),
  ('VAR_CAFE_MONTHLY',       600, 'Café & takeaway',        'Standardbeløb pr. måned foreslået i onboarding-wizarden'),
  ('VAR_LEISURE_MONTHLY',    700, 'Fritid & underholdning', 'Standardbeløb pr. måned foreslået i onboarding-wizarden'),
  ('VAR_MISC_MONTHLY',       800, 'Diverse',                'Standardbeløb pr. måned foreslået i onboarding-wizarden')
) AS e(key, value_numeric, label, notes)
CROSS JOIN standard_data_versions v
WHERE v.version = '2025.1'
  AND v.is_active = true
ON CONFLICT (version_id, key) DO UPDATE
  SET value_numeric = EXCLUDED.value_numeric,
      label         = EXCLUDED.label,
      notes         = EXCLUDED.notes,
      unit          = EXCLUDED.unit;
