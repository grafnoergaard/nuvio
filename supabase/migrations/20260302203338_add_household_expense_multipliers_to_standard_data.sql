/*
  # Add Household Expense Multipliers to Standard Data

  ## Summary
  Adds 12 new entries to the active SDS version for household-based expense calculation.
  Each of the 4 expense categories (Forsikringer, El/Vand/Varme, Abonnementer, Transport)
  gets 3 values: base_amount, adult_multiplier, child_multiplier.

  ## New Entries (section: OEVRIGE_FASTE_UDGIFTER)

  ### Forsikringer
  - FIXED_INSURANCE_BASE: 900 kr/md
  - FIXED_INSURANCE_ADULT_MULTIPLIER: 350 kr per voksen
  - FIXED_INSURANCE_CHILD_MULTIPLIER: 200 kr per barn

  ### El / Vand / Varme
  - FIXED_UTILITIES_BASE: 1300 kr/md
  - FIXED_UTILITIES_ADULT_MULTIPLIER: 350 kr per voksen
  - FIXED_UTILITIES_CHILD_MULTIPLIER: 250 kr per barn

  ### Abonnementer
  - FIXED_SUBSCRIPTIONS_BASE: 600 kr/md
  - FIXED_SUBSCRIPTIONS_ADULT_MULTIPLIER: 150 kr per voksen
  - FIXED_SUBSCRIPTIONS_CHILD_MULTIPLIER: 100 kr per barn

  ### Transport
  - FIXED_TRANSPORT_BASE: 2000 kr/md
  - FIXED_TRANSPORT_ADULT_MULTIPLIER: 1000 kr per voksen
  - FIXED_TRANSPORT_CHILD_MULTIPLIER: 300 kr per barn

  ## Formula
  Total = base_amount + (adult_multiplier × antal_voksne) + (child_multiplier × antal_børn)

  ## Notes
  - Entries are inserted only if they do not already exist (ON CONFLICT DO NOTHING)
  - All values are in DKK/month
  - Multipliers allow estimates to scale with household size
*/

INSERT INTO standard_data_entries (version_id, section, key, value_numeric, unit, label, notes, requires_admin_value)
SELECT
  v.id,
  'OEVRIGE_FASTE_UDGIFTER',
  e.key,
  e.value_numeric,
  'DKK',
  e.label,
  e.notes,
  false
FROM (VALUES
  ('FIXED_INSURANCE_BASE',               900,  'Forsikringer – grundbeløb',              'Fast månedlig grundudgift til forsikringer uanset husstandsstørrelse'),
  ('FIXED_INSURANCE_ADULT_MULTIPLIER',   350,  'Forsikringer – tillæg per voksen',       'Tillæg per voksen husstandsmedlem'),
  ('FIXED_INSURANCE_CHILD_MULTIPLIER',   200,  'Forsikringer – tillæg per barn',         'Tillæg per hjemmeboende barn'),
  ('FIXED_UTILITIES_BASE',              1300,  'El/Vand/Varme – grundbeløb',             'Fast månedlig grundudgift til forsyning uanset husstandsstørrelse'),
  ('FIXED_UTILITIES_ADULT_MULTIPLIER',   350,  'El/Vand/Varme – tillæg per voksen',      'Tillæg per voksen husstandsmedlem'),
  ('FIXED_UTILITIES_CHILD_MULTIPLIER',   250,  'El/Vand/Varme – tillæg per barn',        'Tillæg per hjemmeboende barn'),
  ('FIXED_SUBSCRIPTIONS_BASE',           600,  'Abonnementer – grundbeløb',              'Fast månedlig grundudgift til abonnementer uanset husstandsstørrelse'),
  ('FIXED_SUBSCRIPTIONS_ADULT_MULTIPLIER',150, 'Abonnementer – tillæg per voksen',       'Tillæg per voksen husstandsmedlem'),
  ('FIXED_SUBSCRIPTIONS_CHILD_MULTIPLIER',100, 'Abonnementer – tillæg per barn',         'Tillæg per hjemmeboende barn'),
  ('FIXED_TRANSPORT_BASE',              2000,  'Transport – grundbeløb',                 'Fast månedlig grundudgift til transport uanset husstandsstørrelse'),
  ('FIXED_TRANSPORT_ADULT_MULTIPLIER',  1000,  'Transport – tillæg per voksen',          'Tillæg per voksen husstandsmedlem'),
  ('FIXED_TRANSPORT_CHILD_MULTIPLIER',   300,  'Transport – tillæg per barn',            'Tillæg per hjemmeboende barn')
) AS e(key, value_numeric, label, notes)
CROSS JOIN standard_data_versions v
WHERE v.version = '2025.1'
  AND v.is_active = true
ON CONFLICT (version_id, key) DO NOTHING;
