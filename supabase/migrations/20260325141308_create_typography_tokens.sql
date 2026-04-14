/*
  # Create typography_tokens table

  ## Purpose
  Stores admin-controlled global typography design tokens.
  Tokens are applied as CSS custom properties (--typo-*) across the entire app.
  All authenticated users can read; only admins can write.

  ## New Tables
  - `typography_tokens`
    - `id` (uuid, primary key)
    - `key` (text, unique) — CSS variable suffix, e.g. "font-size-body" → var(--typo-font-size-body)
    - `value` (text) — raw CSS value, e.g. "16px", "700"
    - `label` (text) — human-readable admin label
    - `category` (text) — "font-size" | "font-weight"
    - `description` (text, nullable) — where the token is used
    - `created_at` / `updated_at`

  ## Security
  - RLS enabled
  - Authenticated users can SELECT (tokens apply globally)
  - Only admins (app_metadata.is_admin = true) can INSERT/UPDATE/DELETE

  ## Seed Data
  - 9 font-size tokens (caption through display)
  - 4 font-weight tokens (regular, medium, semibold, bold)
*/

CREATE TABLE IF NOT EXISTS typography_tokens (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text    UNIQUE NOT NULL,
  value       text    NOT NULL,
  label       text    NOT NULL,
  category    text    NOT NULL CHECK (category IN ('font-size', 'font-weight')),
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE typography_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read typography tokens"
  ON typography_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert typography tokens"
  ON typography_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

CREATE POLICY "Admins can update typography tokens"
  ON typography_tokens FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

CREATE POLICY "Admins can delete typography tokens"
  ON typography_tokens FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

CREATE INDEX IF NOT EXISTS idx_typography_tokens_key      ON typography_tokens(key);
CREATE INDEX IF NOT EXISTS idx_typography_tokens_category ON typography_tokens(category);

CREATE OR REPLACE FUNCTION update_typography_tokens_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER typography_tokens_updated_at
  BEFORE UPDATE ON typography_tokens
  FOR EACH ROW EXECUTE FUNCTION update_typography_tokens_updated_at();

INSERT INTO typography_tokens (key, value, label, category, description) VALUES
  ('font-size-caption',    '10px', 'Caption',     'font-size',   'Badges, metadata, version numbers'),
  ('font-size-label',      '11px', 'Label',       'font-size',   'Wizard step labels, nav labels, uppercase captions'),
  ('font-size-body-sm',    '14px', 'Body SM',     'font-size',   'Body text, form labels, table cells'),
  ('font-size-body',       '16px', 'Body',        'font-size',   'Card content, standard reading text'),
  ('font-size-body-lg',    '18px', 'Body LG',     'font-size',   'Wizard explanations, lead paragraphs'),
  ('font-size-heading-sm', '24px', 'Heading SM',  'font-size',   'Section headers, card titles'),
  ('font-size-heading',    '30px', 'Heading',     'font-size',   'Page headers, wizard headlines'),
  ('font-size-heading-lg', '36px', 'Heading LG',  'font-size',   'Large wizard headlines, featured titles'),
  ('font-size-display',    '48px', 'Display',     'font-size',   'Large financial numbers, hero statistics'),
  ('font-weight-regular',  '400',  'Regular',     'font-weight', 'Normal body text'),
  ('font-weight-medium',   '500',  'Medium',      'font-weight', 'Slightly emphasised text'),
  ('font-weight-semibold', '600',  'Semibold',    'font-weight', 'Labels, card titles, nav items'),
  ('font-weight-bold',     '700',  'Bold',        'font-weight', 'Strong emphasis, financial numbers, headings')
ON CONFLICT (key) DO NOTHING;
