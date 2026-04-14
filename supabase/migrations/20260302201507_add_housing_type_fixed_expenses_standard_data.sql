/*
  # Tilføj boligtype-specifikke faste udgiftsestimater

  ## Ændringer

  Udvider FASTE_UDGIFTER-sektionen med estimater pr. boligtype:

  1. EJERBOLIG (parcelhus) — nøgler med præfix FIXED_EJERBOLIG_
     - Realkredit, ejendomsskat, grundejerforening, vedligehold, husforsikring

  2. EJERLEJLIGHED — nøgler med præfix FIXED_EJERLEJLIGHED_
     - Realkredit, ejendomsskat, fællesudgifter, vedligehold

  3. ANDELSBOLIG — nøgler med præfix FIXED_ANDELSBOLIG_
     - Boligafgift, andelslån, vedligehold, forsikringer, el/vand/varme

  4. LEJEBOLIG — nøgler med præfix FIXED_LEJEBOLIG_
     - Husleje

  ## Bemærkninger
  - Alle beløb er månedlige DKK-estimater
  - Poster med 0 kr. repræsenterer udgifter der er indeholdt i andre poster
    eller ikke er relevante for denne boligtype
  - Linkes til aktiv version
*/

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
  -- EJERBOLIG (parcelhus)
  ('FIXED_EJERBOLIG_REALKREDIT_MONTHLY',        11500, 'Ejerbolig — Realkredit',                      'Månedlig ydelse på realkreditlån, parcelhus'),
  ('FIXED_EJERBOLIG_EJENDOMSSKAT_MONTHLY',       2000, 'Ejerbolig — Ejendomsskat',                    'Månedlig ejendomsskat/grundskyld'),
  ('FIXED_EJERBOLIG_GRUNDEJERFORENING_MONTHLY',   350, 'Ejerbolig — Grundejerforening',               'Månedligt kontingent til grundejerforening'),
  ('FIXED_EJERBOLIG_VEDLIGEHOLD_MONTHLY',        2000, 'Ejerbolig — Vedligehold',                     'Månedligt estimat for løbende vedligehold af ejendom'),
  ('FIXED_EJERBOLIG_HUSFORSIKRING_MONTHLY',      1200, 'Ejerbolig — Husforsikring',                   'Månedlig husforsikring for parcelhus'),
  ('FIXED_EJERBOLIG_HAVEFORENING_MONTHLY',        500, 'Ejerbolig — Haveforening/vejbidrag',          'Månedligt bidrag til private fællesveje m.m.'),
  -- EJERLEJLIGHED
  ('FIXED_EJERLEJLIGHED_REALKREDIT_MONTHLY',    10500, 'Ejerlejlighed — Realkredit',                  'Månedlig ydelse på realkreditlån, ejerlejlighed'),
  ('FIXED_EJERLEJLIGHED_EJENDOMSSKAT_MONTHLY',   1500, 'Ejerlejlighed — Ejendomsskat',                'Månedlig ejendomsskat/grundskyld, ejerlejlighed'),
  ('FIXED_EJERLEJLIGHED_FAELLESUDGIFTER_MONTHLY',3000, 'Ejerlejlighed — Fællesudgifter',              'Månedlige fællesudgifter til ejerforening'),
  ('FIXED_EJERLEJLIGHED_VEDLIGEHOLD_MONTHLY',    1000, 'Ejerlejlighed — Vedligehold',                 'Månedligt estimat for vedligehold inde i lejlighed'),
  -- ANDELSBOLIG
  ('FIXED_ANDELSBOLIG_BOLIGAFGIFT_MONTHLY',      8000, 'Andelsbolig — Boligafgift',                   'Månedlig boligafgift til andelsforeningen'),
  ('FIXED_ANDELSBOLIG_ANDELSLAN_MONTHLY',        5000, 'Andelsbolig — Andelslån',                     'Månedlig ydelse på andelslån'),
  ('FIXED_ANDELSBOLIG_VEDLIGEHOLD_MONTHLY',      1000, 'Andelsbolig — Vedligehold',                   'Månedligt estimat for vedligehold inde i boligen'),
  ('FIXED_ANDELSBOLIG_FORSIKRINGER_MONTHLY',     2000, 'Andelsbolig — Forsikringer',                  'Månedligt estimat for indbo- og ulykkesforsikring'),
  ('FIXED_ANDELSBOLIG_ELVANDSVARME_MONTHLY',     2000, 'Andelsbolig — El/Vand/Varme',                 'Månedligt estimat for el, vand og varme'),
  -- LEJEBOLIG
  ('FIXED_LEJEBOLIG_HUSLEJE_MONTHLY',           11500, 'Lejebolig — Husleje',                         'Månedlig husleje inkl. aconto varme/vand')
) AS entries(key, value_numeric, label, notes)
WHERE v.is_active = true
ON CONFLICT (version_id, key) DO NOTHING;
