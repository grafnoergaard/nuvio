/*
  # Create AI Persona Config Table

  ## Purpose
  Stores thresholds and settings for the four AI assistant personas.
  Personas are selected server-side in the Edge Function — never exposed to users.

  ## Personas
  1. **concerned** — Score < concerned_score_threshold OR over budget
     Calm, empathetic, action-oriented tone
  2. **encouraging** — Score between encouraging_score_min and encouraging_score_max
     Acknowledging, motivating tone
  3. **celebratory** — Score >= celebratory_score_threshold AND streak >= celebratory_streak_min
     Happy, confirming, brief tone
  4. **direct** — Weekly transaction count > direct_weekly_tx_threshold
     No-fluff, pure action tone (overrides others when triggered)

  ## Columns
  - `id` — primary key
  - `concerned_score_threshold` — score below this triggers "concerned" (default: 40)
  - `encouraging_score_min` — lower bound for "encouraging" (default: 40)
  - `encouraging_score_max` — upper bound for "encouraging" (default: 79)
  - `celebratory_score_threshold` — score at or above this can trigger "celebratory" (default: 80)
  - `celebratory_streak_min` — minimum streak months for "celebratory" (default: 3)
  - `direct_weekly_tx_threshold` — weekly transactions above this triggers "direct" (default: 10)
  - `is_active` — whether persona system is enabled at all
  - `updated_at`, `updated_by` — audit fields

  ## Security
  - RLS enabled
  - Only authenticated admins (is_admin JWT claim) can read or write
*/

CREATE TABLE IF NOT EXISTS ai_persona_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concerned_score_threshold integer NOT NULL DEFAULT 40,
  encouraging_score_min integer NOT NULL DEFAULT 40,
  encouraging_score_max integer NOT NULL DEFAULT 79,
  celebratory_score_threshold integer NOT NULL DEFAULT 80,
  celebratory_streak_min integer NOT NULL DEFAULT 3,
  direct_weekly_tx_threshold integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT score_range_check CHECK (
    concerned_score_threshold >= 0 AND concerned_score_threshold <= 100
    AND encouraging_score_min >= 0 AND encouraging_score_min <= 100
    AND encouraging_score_max >= 0 AND encouraging_score_max <= 100
    AND celebratory_score_threshold >= 0 AND celebratory_score_threshold <= 100
    AND celebratory_streak_min >= 0
    AND direct_weekly_tx_threshold >= 0
  )
);

ALTER TABLE ai_persona_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read persona config"
  ON ai_persona_config FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

CREATE POLICY "Admins can insert persona config"
  ON ai_persona_config FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

CREATE POLICY "Admins can update persona config"
  ON ai_persona_config FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true)
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

INSERT INTO ai_persona_config (
  concerned_score_threshold,
  encouraging_score_min,
  encouraging_score_max,
  celebratory_score_threshold,
  celebratory_streak_min,
  direct_weekly_tx_threshold,
  is_active
) VALUES (40, 40, 79, 80, 3, 10, true);
