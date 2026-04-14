/*
  # Create advisory_engine_settings table

  ## Summary
  Stores all configurable parameters for the Advisory Engine so they can be
  edited from the Backend admin panel without a code deploy.

  ## New Tables
  - `advisory_engine_settings` (singleton row)
    ### Trigger logic
    - `trigger_high_expense_rate`         boolean  – activate when expense rate exceeds threshold
    - `trigger_high_expense_rate_threshold` numeric – e.g. 0.60 (60 %)
    - `trigger_zero_savings`              boolean  – activate when savings rate = 0
    - `trigger_off_track_goal`            boolean  – activate when longest goal exceeds months threshold
    - `trigger_off_track_goal_months`     integer  – e.g. 72 months

    ### Reduction targets
    - `expense_target_rate`               numeric  – target to reduce expenses to (e.g. 0.55)
    - `savings_target_rate`               numeric  – target savings rate (e.g. 0.10)
    - `max_reduction_pct_per_group`       numeric  – max % of a group that can be suggested for reduction (e.g. 0.15)

    ### Benchmarks (one ratio per category key)
    - `benchmark_housing`   numeric  – default 0.30
    - `benchmark_food`      numeric  – default 0.15
    - `benchmark_transport` numeric  – default 0.10
    - `benchmark_insurance` numeric  – default 0.05
    - `benchmark_telecom`   numeric  – default 0.04
    - `benchmark_leisure`   numeric  – default 0.08
    - `benchmark_other`     numeric  – default 0.15

    ### Benchmark keywords (editable JSON arrays)
    - `keywords_housing`   jsonb
    - `keywords_food`      jsonb
    - `keywords_transport` jsonb
    - `keywords_insurance` jsonb
    - `keywords_telecom`   jsonb
    - `keywords_leisure`   jsonb

    ### Meta
    - `updated_at` timestamptz

  ## Security
  - RLS enabled; only authenticated users can read; only service role can write
    (admin UI writes via anon/authenticated with a permissive policy since this
     is an internal tool — same pattern as mini_checkup_settings)
*/

CREATE TABLE IF NOT EXISTS advisory_engine_settings (
  id                                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Trigger logic
  trigger_high_expense_rate           boolean       NOT NULL DEFAULT true,
  trigger_high_expense_rate_threshold numeric(5,4)  NOT NULL DEFAULT 0.60,
  trigger_zero_savings                boolean       NOT NULL DEFAULT true,
  trigger_off_track_goal              boolean       NOT NULL DEFAULT true,
  trigger_off_track_goal_months       integer       NOT NULL DEFAULT 72,

  -- Reduction targets
  expense_target_rate                 numeric(5,4)  NOT NULL DEFAULT 0.55,
  savings_target_rate                 numeric(5,4)  NOT NULL DEFAULT 0.10,
  max_reduction_pct_per_group         numeric(5,4)  NOT NULL DEFAULT 0.15,

  -- Benchmarks
  benchmark_housing                   numeric(5,4)  NOT NULL DEFAULT 0.30,
  benchmark_food                      numeric(5,4)  NOT NULL DEFAULT 0.15,
  benchmark_transport                 numeric(5,4)  NOT NULL DEFAULT 0.10,
  benchmark_insurance                 numeric(5,4)  NOT NULL DEFAULT 0.05,
  benchmark_telecom                   numeric(5,4)  NOT NULL DEFAULT 0.04,
  benchmark_leisure                   numeric(5,4)  NOT NULL DEFAULT 0.08,
  benchmark_other                     numeric(5,4)  NOT NULL DEFAULT 0.15,

  -- Keywords
  keywords_housing    jsonb NOT NULL DEFAULT '["bolig","husleje","leje","realkreditlån","realkredit","ejerbolig","andel","hus","lejlighed"]',
  keywords_food       jsonb NOT NULL DEFAULT '["mad","dagligvarer","fødevarer","supermarked","groceries","indkøb","husholdning"]',
  keywords_transport  jsonb NOT NULL DEFAULT '["transport","bil","benzin","tog","bus","rejse","parkering","bilvask","køretøj"]',
  keywords_insurance  jsonb NOT NULL DEFAULT '["forsikring","forsikringer"]',
  keywords_telecom    jsonb NOT NULL DEFAULT '["telefon","mobil","internet","tv","streaming","abonnement","tele"]',
  keywords_leisure    jsonb NOT NULL DEFAULT '["fritid","underholdning","sport","hobby","restaurant","café","ferie","oplevelser"]',

  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE advisory_engine_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read advisory engine settings"
  ON advisory_engine_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert advisory engine settings"
  ON advisory_engine_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update advisory engine settings"
  ON advisory_engine_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed one default row
INSERT INTO advisory_engine_settings DEFAULT VALUES;
