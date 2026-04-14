/*
  # Create StandardDataService (SDS) tables

  ## Summary
  Creates a versioned data store for Nuvio StandardDataService —
  the Danish bank-standard benchmark data used for credit assessment
  and financial health scoring.

  ## New Tables

  ### standard_data_versions
  - `id` (uuid, primary key)
  - `version` (text): e.g. "2025.1"
  - `valid_from` (date): First date this version is active
  - `valid_to` (date): Last date this version is active
  - `currency` (text): Always "DKK"
  - `locale` (text): Always "da-DK"
  - `notes` (text): Optional notes
  - `is_active` (boolean): Whether this version is currently in use
  - `created_at` (timestamptz)

  ### standard_data_entries
  - `id` (uuid, primary key)
  - `version_id` (uuid, FK to standard_data_versions)
  - `section` (text): e.g. "RAADIGHED", "BIL", "BOLIG"
  - `key` (text): e.g. "RAADIGHED_BASE_SINGLE_MONTHLY"
  - `value_numeric` (numeric): Numeric value if applicable
  - `value_text` (text): Text/JSON value if applicable
  - `unit` (text): e.g. "DKK/month", "kWh/m2/year"
  - `label` (text): Human-readable Danish label
  - `notes` (text): Optional notes
  - `requires_admin_value` (boolean): If true, must be set by admin — never guessed
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Public read access for authenticated users
  - Admin-only write access

  ## Seed Data
  Seeds the 2025.1 version with all values from the NUVIO_STANDARD_DATA_VERSION: 2025.1 spec
*/

CREATE TABLE IF NOT EXISTS standard_data_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  valid_from date NOT NULL,
  valid_to date NOT NULL,
  currency text NOT NULL DEFAULT 'DKK',
  locale text NOT NULL DEFAULT 'da-DK',
  notes text DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS standard_data_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES standard_data_versions(id) ON DELETE CASCADE,
  section text NOT NULL,
  key text NOT NULL,
  value_numeric numeric DEFAULT NULL,
  value_text text DEFAULT NULL,
  unit text DEFAULT NULL,
  label text NOT NULL,
  notes text DEFAULT NULL,
  requires_admin_value boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(version_id, key)
);

CREATE INDEX IF NOT EXISTS idx_sds_entries_version_id ON standard_data_entries(version_id);
CREATE INDEX IF NOT EXISTS idx_sds_entries_section ON standard_data_entries(section);
CREATE INDEX IF NOT EXISTS idx_sds_entries_key ON standard_data_entries(key);
CREATE INDEX IF NOT EXISTS idx_sds_versions_active ON standard_data_versions(is_active) WHERE is_active = true;

ALTER TABLE standard_data_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE standard_data_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read standard_data_versions"
  ON standard_data_versions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert standard_data_versions"
  ON standard_data_versions FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

CREATE POLICY "Admins can update standard_data_versions"
  ON standard_data_versions FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true)
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

CREATE POLICY "Admins can delete standard_data_versions"
  ON standard_data_versions FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

CREATE POLICY "Authenticated users can read standard_data_entries"
  ON standard_data_entries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert standard_data_entries"
  ON standard_data_entries FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

CREATE POLICY "Admins can update standard_data_entries"
  ON standard_data_entries FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true)
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

CREATE POLICY "Admins can delete standard_data_entries"
  ON standard_data_entries FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

-- Seed 2025.1 version
INSERT INTO standard_data_versions (version, valid_from, valid_to, currency, locale, notes, is_active)
VALUES (
  '2025.1',
  '2025-01-01',
  '2025-12-31',
  'DKK',
  'da-DK',
  'NUVIO_STANDARD_DATA_VERSION: 2025.1 — Gældsstyrelsen rådighedssatser, FDM bilbudget, ENS varmeforbrug',
  true
)
ON CONFLICT (version) DO NOTHING;

-- Seed entries for 2025.1
DO $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM standard_data_versions WHERE version = '2025.1';

  -- RAADIGHED section
  INSERT INTO standard_data_entries (version_id, section, key, value_numeric, unit, label, notes)
  VALUES
    (v_id, 'RAADIGHED', 'RAADIGHED_BASE_SINGLE_MONTHLY', 7520, 'DKK/month',
     'Rådighedsbeløb — enlig voksen', 'Gældsstyrelsen 2025'),
    (v_id, 'RAADIGHED', 'RAADIGHED_EXTRA_ADULT_IN_HOUSEHOLD_MONTHLY', 5230, 'DKK/month',
     'Tillæg pr. ekstra voksen i husstanden', 'Gældsstyrelsen 2025'),
    (v_id, 'RAADIGHED', 'CHILD_ADDON_0_1_MONTHLY', 2050, 'DKK/month',
     'Børnetillæg — 0-1 år', 'Gældsstyrelsen 2025'),
    (v_id, 'RAADIGHED', 'CHILD_ADDON_2_6_MONTHLY', 2620, 'DKK/month',
     'Børnetillæg — 2-6 år', 'Gældsstyrelsen 2025'),
    (v_id, 'RAADIGHED', 'CHILD_ADDON_7_17_MONTHLY', 3770, 'DKK/month',
     'Børnetillæg — 7-17 år', 'Gældsstyrelsen 2025')
  ON CONFLICT (version_id, key) DO NOTHING;

  -- BIL section
  INSERT INTO standard_data_entries (version_id, section, key, value_numeric, value_text, unit, label, notes)
  VALUES
    (v_id, 'BIL', 'CAR_BUDGET_NEW_ICE_150K_MONTHLY', 5096, NULL, 'DKK/month',
     'Bilbudget — ny benzin/diesel 150.000 kr.', 'FDM 2025, 20.000 km/år'),
    (v_id, 'BIL', 'CAR_BUDGET_NEW_ICE_200K_MONTHLY', 5746, NULL, 'DKK/month',
     'Bilbudget — ny benzin/diesel 200.000 kr.', 'FDM 2025, 20.000 km/år'),
    (v_id, 'BIL', 'CAR_BUDGET_NEW_EV_200K_MONTHLY', 5051, NULL, 'DKK/month',
     'Bilbudget — ny elbil 200.000 kr.', 'FDM 2025, 20.000 km/år'),
    (v_id, 'BIL', 'CAR_BUDGET_NEW_ICE_300K_MONTHLY', 7001, NULL, 'DKK/month',
     'Bilbudget — ny benzin/diesel 300.000 kr.', 'FDM 2025, 20.000 km/år'),
    (v_id, 'BIL', 'CAR_BUDGET_NEW_EV_300K_MONTHLY', 6290, NULL, 'DKK/month',
     'Bilbudget — ny elbil 300.000 kr.', 'FDM 2025, 20.000 km/år'),
    (v_id, 'BIL', 'CAR_BUDGET_NEW_ICE_400K_MONTHLY', 8230, NULL, 'DKK/month',
     'Bilbudget — ny benzin/diesel 400.000 kr.', 'FDM 2025, 20.000 km/år'),
    (v_id, 'BIL', 'CAR_BUDGET_NEW_EV_400K_MONTHLY', 7373, NULL, 'DKK/month',
     'Bilbudget — ny elbil 400.000 kr.', 'FDM 2025, 20.000 km/år'),
    (v_id, 'BIL', 'CAR_BUDGET_DEFAULT_ID', NULL, 'NEW_ICE_150K', NULL,
     'Standard bil-scenarie (default)', 'Bruges hvis bruger blot siger "jeg har bil"')
  ON CONFLICT (version_id, key) DO NOTHING;

  -- BOLIG / VARME section
  INSERT INTO standard_data_entries (version_id, section, key, value_numeric, unit, label, notes)
  VALUES
    (v_id, 'BOLIG', 'HEAT_FJERNVARME_ETAGEBOLIG_KWH_PER_M2_PER_YEAR', 97, 'kWh/m2/year',
     'Fjernvarme — etagebolig, gennemsnit', 'Energistyrelsen 2025')
  ON CONFLICT (version_id, key) DO NOTHING;

END $$;
