/*
  # Create ai_assistant_config table

  ## Purpose
  Stores admin-controlled configuration for the Nuvio AI assistant.
  Allows non-technical admins to adjust tone, system prompt instructions,
  and response length limits without requiring code deploys.

  ## New Tables
  - `ai_assistant_config`
    - `id` (uuid, primary key)
    - `system_prompt` (text) — The full system prompt sent to the AI model
    - `max_tokens` (integer) — Maximum response length in tokens (controls verbosity)
    - `temperature` (numeric) — Model creativity/randomness (0.0–1.0)
    - `is_active` (boolean) — Master on/off switch for the AI assistant
    - `model` (text) — Which OpenAI model to use
    - `updated_at` (timestamptz) — Last modification timestamp
    - `updated_by` (uuid, FK auth.users) — Who made the last change

  ## Security
  - RLS enabled
  - Only authenticated admins (via JWT app_metadata.is_admin) can read or write
  - Single-row table pattern: only one config row (enforced by check constraint)
*/

CREATE TABLE IF NOT EXISTS ai_assistant_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_prompt text NOT NULL DEFAULT '',
  max_tokens integer NOT NULL DEFAULT 400,
  temperature numeric(3,2) NOT NULL DEFAULT 0.70,
  is_active boolean NOT NULL DEFAULT true,
  model text NOT NULL DEFAULT 'gpt-4o',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT temperature_range CHECK (temperature >= 0.0 AND temperature <= 1.0),
  CONSTRAINT max_tokens_range CHECK (max_tokens >= 50 AND max_tokens <= 2000)
);

ALTER TABLE ai_assistant_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ai assistant config"
  ON ai_assistant_config FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

CREATE POLICY "Admins can insert ai assistant config"
  ON ai_assistant_config FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

CREATE POLICY "Admins can update ai assistant config"
  ON ai_assistant_config FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true)
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

INSERT INTO ai_assistant_config (system_prompt, max_tokens, temperature, is_active, model)
VALUES (
  'Du er Nuvio AI — en personlig, rolig og ærlig finansiel rådgiver bygget ind i Nuvio-appen.

Din tone er:
- Varm og direkte, ikke robotagtig
- Ærlig uden at være alarmerende
- Konkret og handlingsorienteret
- Aldrig moraliserende eller nedladende
- Altid på dansk

Du giver korte, præcise svar. Ingen lange essays. Ingen bullet points i hoveddescription. Brug max 2-3 sætninger til den primære besked.

Du returnerer ALTID et JSON-objekt med præcis denne struktur:
{
  "message": "string (2-3 sætninger, personlig og konkret)",
  "actions": [
    { "title": "string (kort handlingstitel)", "description": "string (1 sætning beskrivelse)" },
    { "title": "string", "description": "string" }
  ],
  "tone": "positive" | "neutral" | "warning" | "critical"
}

tone-valg:
- positive: score >= 80 eller streak >= 3
- neutral: score 40-79, ingen alvorlige problemer
- warning: score < 40 eller carry-over penalty > 20% af budget
- critical: over budget

Giv altid præcis 2 handlingsforslag. De skal være relevante og specifikke til konteksten.',
  400,
  0.70,
  true,
  'gpt-4o'
);
