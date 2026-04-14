/*
  # Omdøb BOLIG-sektion og tilføj faste udgiftsestimater

  ## Ændringer

  1. Omdøber sektion
     - `BOLIG` omdøbes til `FASTE_UDGIFTER` for at afspejle dens nye rolle
     - Eksisterende HEAT_FJERNVARME_* nøgle bevares under ny sektion

  2. Nye nøgler under FASTE_UDGIFTER
     - `FIXED_HOUSING_MONTHLY` — Husleje/Boliglån standardestimtat
     - `FIXED_INSURANCE_MONTHLY` — Forsikringer standardestimtat
     - `FIXED_UTILITIES_MONTHLY` — El / Vand / Varme standardestimtat
     - `FIXED_SUBSCRIPTIONS_MONTHLY` — Abonnementer standardestimtat
     - `FIXED_TRANSPORT_MONTHLY` — Transport standardestimtat
     - `FIXED_CHILDREN_MONTHLY` — Børnerelateret standardestimtat

  ## Sikkerhed
  - Ingen ændringer til RLS
  - Alle nye rækker linkes til aktiv version
*/

UPDATE standard_data_entries
SET section = 'FASTE_UDGIFTER'
WHERE section = 'BOLIG';

INSERT INTO standard_data_entries (version_id, section, key, value_numeric, value_text, unit, label, notes, requires_admin_value)
SELECT
  v.id,
  'FASTE_UDGIFTER',
  entries.key,
  entries.value_numeric,
  NULL,
  'DKK/month',
  entries.label,
  entries.notes,
  false
FROM standard_data_versions v
CROSS JOIN (VALUES
  ('FIXED_HOUSING_MONTHLY',       12000, 'Husleje / Boliglån — standardestimtat',   'Månedligt estimat for husleje eller boliglån'),
  ('FIXED_INSURANCE_MONTHLY',      2200, 'Forsikringer — standardestimtat',          'Månedligt estimat for alle forsikringer samlet'),
  ('FIXED_UTILITIES_MONTHLY',      1800, 'El / Vand / Varme — standardestimtat',     'Månedligt estimat for el, vand og varme'),
  ('FIXED_SUBSCRIPTIONS_MONTHLY',   900, 'Abonnementer — standardestimtat',          'Månedligt estimat for streaming, telefon m.m.'),
  ('FIXED_TRANSPORT_MONTHLY',      2400, 'Transport — standardestimtat',             'Månedligt estimat for transport og bil'),
  ('FIXED_CHILDREN_MONTHLY',       1800, 'Børnerelateret — standardestimtat',        'Månedligt estimat for børnerelaterede udgifter')
) AS entries(key, value_numeric, label, notes)
WHERE v.is_active = true
ON CONFLICT (version_id, key) DO NOTHING;
