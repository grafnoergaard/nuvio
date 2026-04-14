/*
  # Add plan sub-items as top-level nav_items (v2)

  ## Summary
  Converts Plan submenu items to top-level navigation items.
  Drops the unique constraint on href to allow multiple items with the same href
  (e.g. multiple items pointing to /budgets but with different href_templates).

  ## Changes
  - Drops unique constraint on nav_items.href
  - Adds href_template, requires_budget, requires_transactions columns to nav_items
  - Adds "Planlægning" nav_group
  - Inserts Årsplan, Importer, Variable udgifter, Alle planer as nav_items
*/

ALTER TABLE nav_items DROP CONSTRAINT IF EXISTS nav_items_href_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nav_items' AND column_name = 'href_template'
  ) THEN
    ALTER TABLE nav_items ADD COLUMN href_template text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nav_items' AND column_name = 'requires_budget'
  ) THEN
    ALTER TABLE nav_items ADD COLUMN requires_budget boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nav_items' AND column_name = 'requires_transactions'
  ) THEN
    ALTER TABLE nav_items ADD COLUMN requires_transactions boolean NOT NULL DEFAULT false;
  END IF;
END $$;

INSERT INTO nav_groups (id, name, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000003', 'Planlægning', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO nav_items (name, href, href_template, icon_name, sort_order, group_id, requires_budget, requires_transactions, is_system)
SELECT 'Årsplan', '/budgets', '/budgets/{budgetId}/details', 'FileText', 0, '00000000-0000-0000-0000-000000000003', true, false, false
WHERE NOT EXISTS (SELECT 1 FROM nav_items WHERE href_template = '/budgets/{budgetId}/details');

INSERT INTO nav_items (name, href, href_template, icon_name, sort_order, group_id, requires_budget, requires_transactions, is_system)
SELECT 'Importer', '/budgets', '/budgets/{budgetId}/import', 'Upload', 1, '00000000-0000-0000-0000-000000000003', true, false, false
WHERE NOT EXISTS (SELECT 1 FROM nav_items WHERE href_template = '/budgets/{budgetId}/import');

INSERT INTO nav_items (name, href, href_template, icon_name, sort_order, group_id, requires_budget, requires_transactions, is_system)
SELECT 'Variable udgifter', '/variable-forbrug', NULL, 'Shuffle', 2, '00000000-0000-0000-0000-000000000003', false, false, false
WHERE NOT EXISTS (SELECT 1 FROM nav_items WHERE href = '/variable-forbrug');

INSERT INTO nav_items (name, href, href_template, icon_name, sort_order, group_id, requires_budget, requires_transactions, is_system)
SELECT 'Alle planer', '/budgets', NULL, 'List', 3, '00000000-0000-0000-0000-000000000003', false, false, false
WHERE NOT EXISTS (SELECT 1 FROM nav_items WHERE name = 'Alle planer');
