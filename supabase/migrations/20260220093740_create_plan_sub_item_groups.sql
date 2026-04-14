/*
  # Create plan sub-item groups

  ## Summary
  Adds the ability to group the Plan submenu items into named sections in the admin backend.

  ## New Tables
  - `nav_plan_sub_groups`
    - `id` (uuid, PK)
    - `name` (text) – display label, e.g. "Planlægning"
    - `sort_order` (int) – ordering of groups within the Plan submenu
    - `created_at` / `updated_at`

  ## Modified Tables
  - `nav_items`
    - Added `plan_sub_group_id` (uuid, nullable FK → nav_plan_sub_groups) – links a nav_item that is
      a Plan sub-item to a named sub-group. Only relevant for items with href like the plan sub-items.

  ## Security
  - RLS enabled on `nav_plan_sub_groups`
  - Authenticated users can read and write (same pattern as nav_groups / nav_items)

  ## Notes
  1. Existing Plan sub-items in nav_items are hardcoded in sidebar.tsx; this migration only adds the
     data structures. The sidebar and admin UI will be updated to use these groups.
  2. Seeds one default group "Planlægning" so the admin can immediately start assigning items.
  3. Does NOT drop or alter existing data.
*/

CREATE TABLE IF NOT EXISTS nav_plan_sub_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE nav_plan_sub_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read nav_plan_sub_groups"
  ON nav_plan_sub_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert nav_plan_sub_groups"
  ON nav_plan_sub_groups FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update nav_plan_sub_groups"
  ON nav_plan_sub_groups FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete nav_plan_sub_groups"
  ON nav_plan_sub_groups FOR DELETE
  TO authenticated
  USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nav_items' AND column_name = 'plan_sub_group_id'
  ) THEN
    ALTER TABLE nav_items ADD COLUMN plan_sub_group_id uuid REFERENCES nav_plan_sub_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS nav_plan_sub_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  href_template text NOT NULL,
  icon_name text NOT NULL DEFAULT 'Home',
  sort_order int NOT NULL DEFAULT 0,
  sub_group_id uuid REFERENCES nav_plan_sub_groups(id) ON DELETE SET NULL,
  requires_budget boolean NOT NULL DEFAULT false,
  requires_transactions boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE nav_plan_sub_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read nav_plan_sub_items"
  ON nav_plan_sub_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert nav_plan_sub_items"
  ON nav_plan_sub_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update nav_plan_sub_items"
  ON nav_plan_sub_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete nav_plan_sub_items"
  ON nav_plan_sub_items FOR DELETE
  TO authenticated
  USING (true);

INSERT INTO nav_plan_sub_groups (id, name, sort_order) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Planlægning', 0)
ON CONFLICT DO NOTHING;

INSERT INTO nav_plan_sub_items (name, href_template, icon_name, sort_order, sub_group_id, requires_budget, requires_transactions, is_system) VALUES
  ('Overblik', '/plan', 'LayoutDashboard', 0, NULL, false, false, true),
  ('Årsplan', '/budgets/{budgetId}/details', 'FileText', 1, '10000000-0000-0000-0000-000000000001', true, false, false),
  ('Importer', '/budgets/{budgetId}/import', 'Upload', 2, '10000000-0000-0000-0000-000000000001', true, false, false),
  ('Variable udgifter', '/variable-forbrug', 'Shuffle', 3, '10000000-0000-0000-0000-000000000001', false, false, false),
  ('Alle planer', '/budgets', 'List', 4, '10000000-0000-0000-0000-000000000001', false, false, false)
ON CONFLICT DO NOTHING;
