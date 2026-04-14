/*
  # Insert Beregningssatser into standard_data_entries

  Adds all calculation rate entries for the BEREGNING section into the active version (2025.1).
  These entries power the variable expense calculator and replace the old calculation_rates table.

  ## New entries (section: BEREGNING)

  ### Adult rates
  - CALC_ADULT_STANDARD: Standard monthly rate per adult (DKK)
  - CALC_STUDENT_SINGLE: Monthly rate for single student (DKK)
  - CALC_STUDENT_COUPLE: Monthly rate per person for student couple (DKK)

  ### Child rates by age group
  - CALC_CHILD_0_2: Monthly rate for children age 0-2 (DKK)
  - CALC_CHILD_3_12: Monthly rate for children age 3-12 (DKK)
  - CALC_CHILD_13_17: Monthly rate for children age 13-17 (DKK)

  ### Regional multipliers (fraction of base, e.g. 0.10 = +10%)
  - CALC_REGIONAL_URBAN_HIGH: Storby høj (København, 1000-2999)
  - CALC_REGIONAL_URBAN_MED: By mellem (Aarhus, 8000-8999)
  - CALC_REGIONAL_URBAN_LOW: By lav (Odense/Sydjylland, 5000-6999)
  - CALC_REGIONAL_RURAL: Landlig fradrag (Bornholm, øer, mv.)

  ### Postal range rules (stored as JSON array)
  - CALC_POSTAL_RANGES_JSON: JSON array of postal range rules

  ## Notes
  - All entries are linked to the active 2025.1 version
  - Uses INSERT ... ON CONFLICT DO NOTHING for idempotency
*/

DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM standard_data_versions WHERE version = '2025.1' AND is_active = true LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No active 2025.1 version found';
  END IF;

  INSERT INTO standard_data_entries (version_id, section, key, value_numeric, value_text, unit, label, notes, requires_admin_value)
  VALUES
    (v_id, 'BEREGNING', 'CALC_ADULT_STANDARD',       4000,  NULL, 'DKK/month', 'Voksen (standard)',               'Månedlig baserate pr. voksen i standardtilstand',               false),
    (v_id, 'BEREGNING', 'CALC_STUDENT_SINGLE',        3200,  NULL, 'DKK/month', 'Studerende (1 voksen)',            'Månedlig rate for enlig studerende',                            false),
    (v_id, 'BEREGNING', 'CALC_STUDENT_COUPLE',        3000,  NULL, 'DKK/month', 'Studerende (2+ voksne)',           'Månedlig rate pr. voksen for studerende parhusstand',           false),
    (v_id, 'BEREGNING', 'CALC_CHILD_0_2',             2200,  NULL, 'DKK/month', 'Børn 0–2 år',                    'Månedlig rate pr. barn i alderen 0–2 år',                       false),
    (v_id, 'BEREGNING', 'CALC_CHILD_3_12',            2800,  NULL, 'DKK/month', 'Børn 3–12 år',                   'Månedlig rate pr. barn i alderen 3–12 år',                      false),
    (v_id, 'BEREGNING', 'CALC_CHILD_13_17',           3200,  NULL, 'DKK/month', 'Børn 13–17 år',                  'Månedlig rate pr. barn i alderen 13–17 år',                     false),
    (v_id, 'BEREGNING', 'CALC_REGIONAL_URBAN_HIGH',   NULL,  '0.1',  'x basis',   'Regionalt tillæg — storby (høj)', 'Multiplikatortillæg for postnr. 1000–2999 (+10%)',              false),
    (v_id, 'BEREGNING', 'CALC_REGIONAL_URBAN_MED',    NULL,  '0.05', 'x basis',   'Regionalt tillæg — by (5k)',       'Multiplikatortillæg for postnr. 5000–6999 (+5%)',               false),
    (v_id, 'BEREGNING', 'CALC_REGIONAL_URBAN_LOW',    NULL,  '0.03', 'x basis',   'Regionalt tillæg — by (3k)',       'Multiplikatortillæg for postnr. 8000–8999 (+3%)',               false),
    (v_id, 'BEREGNING', 'CALC_REGIONAL_RURAL',        NULL,  '-0.03','x basis',   'Regionalt fradrag — land',         'Multiplikatorfradrag for landlige postnumre (−3%)',             false),
    (v_id, 'BEREGNING', 'CALC_POSTAL_RANGES_JSON',    NULL,
      '[{"id":"1","label":"København og omegn","postal_from":1000,"postal_to":2999,"rate_key":"regional_urban_high","sort_order":1},{"id":"2","label":"Aarhus","postal_from":8000,"postal_to":8999,"rate_key":"regional_urban_med","sort_order":2},{"id":"3","label":"Odense og Sydjylland","postal_from":5000,"postal_to":6999,"rate_key":"regional_urban_low","sort_order":3},{"id":"4","label":"Bornholm","postal_from":3700,"postal_to":3999,"rate_key":"regional_rural","sort_order":4},{"id":"5","label":"Sydsjælland og øer","postal_from":4700,"postal_to":4999,"rate_key":"regional_rural","sort_order":5},{"id":"6","label":"Thy og Mors","postal_from":7900,"postal_to":7999,"rate_key":"regional_rural","sort_order":6},{"id":"7","label":"Nordjylland (nordligste del)","postal_from":9700,"postal_to":9999,"rate_key":"regional_rural","sort_order":7}]',
      'JSON', 'Postnummerregler (JSON)', 'Definerer hvilke postnummerintervaller der tilhører hvilken regional multiplikator', false)
  ON CONFLICT (version_id, key) DO NOTHING;
END $$;
