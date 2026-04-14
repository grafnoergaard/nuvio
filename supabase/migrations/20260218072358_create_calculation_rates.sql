/*
  # Create Calculation Rates Table

  ## Purpose
  Stores all configurable rate values used by the variable spending calculator.
  Admins can edit these via the Backend > Beregning page.

  ## New Tables
  - `calculation_rates`
    - `key` (text, primary key) – machine-readable identifier
    - `label` (text) – human-readable Danish label
    - `value` (numeric) – the rate value
    - `description` (text) – explanation of the rate
    - `group` (text) – grouping for display (adults, children, student, regional)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled; authenticated users can read and update rates.

  ## Seed Data
  Default Danish banking baseline rates inserted on creation.
*/

CREATE TABLE IF NOT EXISTS calculation_rates (
  key text PRIMARY KEY,
  label text NOT NULL,
  value numeric NOT NULL,
  description text NOT NULL DEFAULT '',
  "group" text NOT NULL DEFAULT 'general',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE calculation_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read rates"
  ON calculation_rates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update rates"
  ON calculation_rates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert rates"
  ON calculation_rates FOR INSERT
  TO authenticated
  WITH CHECK (true);

INSERT INTO calculation_rates (key, label, value, description, "group") VALUES
  ('adult_standard',       'Voksen (standard)',          4000,  'Månedlig basisrate pr. voksen i standardtilstand',    'adults'),
  ('student_single',       'Studerende (1 voksen)',       3200,  'Månedlig rate for enlig studerende',                  'student'),
  ('student_couple',       'Studerende (2+ voksne)',      3000,  'Månedlig rate pr. voksen for studerende par/husstand','student'),
  ('child_0_2',            'Barn 0–2 år',                 2200,  'Månedlig rate for barn i alderen 0–2 år',             'children'),
  ('child_3_12',           'Barn 3–12 år',                2800,  'Månedlig rate for barn i alderen 3–12 år',            'children'),
  ('child_13_17',          'Barn 13–17 år',               3200,  'Månedlig rate for barn i alderen 13–17 år',           'children'),
  ('regional_urban_high',  'Regionalt tillæg – storby',  0.10,  'Multiplikatortillæg for postnr. 1000–2999 (+10%)',    'regional'),
  ('regional_urban_med',   'Regionalt tillæg – by (8k)', 0.05,  'Multiplikatortillæg for postnr. 8000–8999 (+5%)',     'regional'),
  ('regional_urban_low',   'Regionalt tillæg – by (5k)', 0.03,  'Multiplikatortillæg for postnr. 5000–6999 (+3%)',     'regional'),
  ('regional_rural',       'Regionalt fradrag – land',  -0.03,  'Multiplikatorfradrag for landlige postnumre (-3%)',   'regional')
ON CONFLICT (key) DO NOTHING;
