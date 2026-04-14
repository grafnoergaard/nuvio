/*
  # Opret mobile_nav_slots tabel

  ## Beskrivelse
  Opretter en tabel med præcis 4 slots til bundmenuen på mobil.
  Hver slot har en fast position (1-4) og peger på et nav_item.
  
  ## Nye tabeller
  - `mobile_nav_slots`
    - `id` (uuid, primary key)
    - `position` (integer, 1-4, unik) — slot-nummer i bundmenuen
    - `nav_item_id` (uuid, FK til nav_items, nullable) — hvilket menupunkt der vises
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Sikkerhed
  - RLS aktiveret
  - Alle authenticated brugere kan læse slots (til at vise mobilmenuen)
  - Kun admins kan skrive (via service_role / admin edge functions)
  - Admin-check via JWT app_metadata.is_admin

  ## Standarddata
  Indsætter 4 tomme slots (position 1-4) som udgangspunkt.
  Seeder med de 4 nuværende hardcodede ikoner: Nuvio Flow, Investering, Checkup, Mål
  baseret på href-match.
*/

CREATE TABLE IF NOT EXISTS mobile_nav_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position integer NOT NULL CHECK (position >= 1 AND position <= 4),
  nav_item_id uuid REFERENCES nav_items(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT mobile_nav_slots_position_unique UNIQUE (position)
);

CREATE INDEX IF NOT EXISTS mobile_nav_slots_position_idx ON mobile_nav_slots (position);
CREATE INDEX IF NOT EXISTS mobile_nav_slots_nav_item_id_idx ON mobile_nav_slots (nav_item_id);

ALTER TABLE mobile_nav_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read mobile nav slots"
  ON mobile_nav_slots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert mobile nav slots"
  ON mobile_nav_slots FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

CREATE POLICY "Admins can update mobile nav slots"
  ON mobile_nav_slots FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true)
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

CREATE POLICY "Admins can delete mobile nav slots"
  ON mobile_nav_slots FOR DELETE
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true);

INSERT INTO mobile_nav_slots (position, nav_item_id)
VALUES
  (1, (SELECT id FROM nav_items WHERE href = '/nuvio-flow' LIMIT 1)),
  (2, (SELECT id FROM nav_items WHERE href = '/investering' LIMIT 1)),
  (3, (SELECT id FROM nav_items WHERE href = '/checkup' LIMIT 1)),
  (4, (SELECT id FROM nav_items WHERE href = '/maal' LIMIT 1))
ON CONFLICT (position) DO NOTHING;
