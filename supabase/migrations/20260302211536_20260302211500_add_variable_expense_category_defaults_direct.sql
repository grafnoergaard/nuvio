/*
  # Add variable expense category default amounts to standard data

  ## Summary
  The active standard_data_version has valid_to = 2025-12-31 which is in the past.
  This migration extends the version's validity and inserts the five variable
  expense category default amounts directly using the known version id.

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
WHERE id = 'bfb5ffdf-15c0-4696-9a81-3b176a33fb84'
  AND is_active = true;

INSERT INTO standard_data_entries (version_id, section, key, value_numeric, value_text, unit, label, notes, requires_admin_value)
VALUES
  ('bfb5ffdf-15c0-4696-9a81-3b176a33fb84', 'VARIABELT_FORBRUG', 'VAR_FOOD_MONTHLY',      3000, NULL, 'kr/md', 'Mad & dagligvarer',       'Standardbeløb pr. måned foreslået i onboarding-wizarden', false),
  ('bfb5ffdf-15c0-4696-9a81-3b176a33fb84', 'VARIABELT_FORBRUG', 'VAR_TRANSPORT_MONTHLY',  1200, NULL, 'kr/md', 'Transport',               'Standardbeløb pr. måned foreslået i onboarding-wizarden', false),
  ('bfb5ffdf-15c0-4696-9a81-3b176a33fb84', 'VARIABELT_FORBRUG', 'VAR_CAFE_MONTHLY',        600, NULL, 'kr/md', 'Café & takeaway',         'Standardbeløb pr. måned foreslået i onboarding-wizarden', false),
  ('bfb5ffdf-15c0-4696-9a81-3b176a33fb84', 'VARIABELT_FORBRUG', 'VAR_LEISURE_MONTHLY',     700, NULL, 'kr/md', 'Fritid & underholdning',  'Standardbeløb pr. måned foreslået i onboarding-wizarden', false),
  ('bfb5ffdf-15c0-4696-9a81-3b176a33fb84', 'VARIABELT_FORBRUG', 'VAR_MISC_MONTHLY',        800, NULL, 'kr/md', 'Diverse',                 'Standardbeløb pr. måned foreslået i onboarding-wizarden', false)
ON CONFLICT (version_id, key) DO UPDATE
  SET value_numeric = EXCLUDED.value_numeric,
      label         = EXCLUDED.label,
      notes         = EXCLUDED.notes,
      unit          = EXCLUDED.unit;
