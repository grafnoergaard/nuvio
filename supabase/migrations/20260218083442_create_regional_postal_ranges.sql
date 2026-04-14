/*
  # Create regional_postal_ranges table

  ## Purpose
  Stores configurable postal code ranges used by the variable expense calculation engine
  to apply regional cost-of-living adjustments. Previously these ranges were hardcoded
  in the calculation engine; now they are fully manageable from the backend.

  ## New Table: regional_postal_ranges
  - `id` (uuid, primary key)
  - `label` (text) – Human-readable name, e.g. "København og omegn"
  - `postal_from` (int) – Start of postal code range (inclusive)
  - `postal_to` (int) – End of postal code range (inclusive)
  - `rate_key` (text) – References which rate to apply: regional_urban_high | regional_urban_med | regional_urban_low | regional_rural
  - `sort_order` (int) – Controls display order in admin UI
  - `created_at`, `updated_at` (timestamps)

  ## Security
  - RLS enabled; only authenticated users (admins) can read/write
  - Public read is intentionally NOT granted here (backend only)

  ## Seed data
  Matches the ranges previously hardcoded in calculation-engine.ts:
  - 1000–2999: regional_urban_high  (København, +10%)
  - 8000–8999: regional_urban_med   (Aarhus, +5%)
  - 5000–6999: regional_urban_low   (Odense/Sydjylland, +3%)
  - 3700–3999: regional_rural       (Bornholm, -3%)
  - 4700–4999: regional_rural       (Sydsjælland, -3%)
  - 7900–7999: regional_rural       (Thy/Mors, -3%)
  - 9700–9999: regional_rural       (Nordjylland nord, -3%)
*/

CREATE TABLE IF NOT EXISTS regional_postal_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT '',
  postal_from integer NOT NULL,
  postal_to integer NOT NULL,
  rate_key text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE regional_postal_ranges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read postal ranges"
  ON regional_postal_ranges FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert postal ranges"
  ON regional_postal_ranges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update postal ranges"
  ON regional_postal_ranges FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete postal ranges"
  ON regional_postal_ranges FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

INSERT INTO regional_postal_ranges (label, postal_from, postal_to, rate_key, sort_order) VALUES
  ('København og omegn',           1000, 2999, 'regional_urban_high', 1),
  ('Aarhus',                        8000, 8999, 'regional_urban_med',  2),
  ('Odense og Sydjylland',          5000, 6999, 'regional_urban_low',  3),
  ('Bornholm',                      3700, 3999, 'regional_rural',      4),
  ('Sydsjælland og øer',            4700, 4999, 'regional_rural',      5),
  ('Thy og Mors',                   7900, 7999, 'regional_rural',      6),
  ('Nordjylland (nordligste del)',   9700, 9999, 'regional_rural',      7);
