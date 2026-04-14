/*
  # Remove Category Table and Make Recipients Direct Children of CategoryGroup

  ## Schema Changes

  ### 1. Modify recipients table
    - Add `category_group_id` (uuid, FK -> category_groups, NOT NULL)
    - Remove `default_category_id`
    - Change unique constraint from `name` to `(category_group_id, name)`

  ### 2. Data Migration
    - Create recipient rows from existing category rows
    - Update transactions.recipient_id based on category_id mapping

  ### 3. Drop category-related columns and tables
    - Drop transactions.category_id
    - Drop budget_lines table
    - Drop categories table

  ### 4. Indexes
    - Update indexes to reflect new structure
*/

-- Step 1: Add category_group_id to recipients table (nullable initially)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recipients' AND column_name = 'category_group_id'
  ) THEN
    ALTER TABLE recipients ADD COLUMN category_group_id uuid REFERENCES category_groups(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 2: Create mapping table to track category->recipient conversion
CREATE TEMP TABLE category_to_recipient_mapping AS
SELECT
  c.id as category_id,
  c.name as category_name,
  c.category_group_id,
  r.id as existing_recipient_id
FROM categories c
LEFT JOIN recipients r ON r.name = c.name AND r.default_category_id = c.id;

-- Step 3: Create recipients from categories
INSERT INTO recipients (name, category_group_id)
SELECT DISTINCT
  c.name,
  c.category_group_id
FROM categories c
WHERE NOT EXISTS (
  SELECT 1 FROM recipients r
  WHERE r.name = c.name
)
ON CONFLICT (name) DO NOTHING;

-- Step 4: Update mapping table with newly created recipient IDs
UPDATE category_to_recipient_mapping m
SET existing_recipient_id = r.id
FROM recipients r
WHERE r.name = m.category_name
  AND r.category_group_id = m.category_group_id
  AND m.existing_recipient_id IS NULL;

-- Step 5: Update existing recipients to have category_group_id
UPDATE recipients r
SET category_group_id = c.category_group_id
FROM categories c
WHERE r.default_category_id = c.id
  AND r.category_group_id IS NULL;

-- Step 6: Update transactions.recipient_id based on category_id mapping
UPDATE transactions t
SET recipient_id = m.existing_recipient_id
FROM category_to_recipient_mapping m
WHERE t.category_id = m.category_id
  AND t.recipient_id IS NULL;

-- Step 7: Create recipients for remaining transactions with category_id
INSERT INTO recipients (name, category_group_id)
SELECT DISTINCT
  COALESCE(t.recipient_name, t.description, 'Unknown') as name,
  c.category_group_id
FROM transactions t
INNER JOIN categories c ON c.id = t.category_id
WHERE t.recipient_id IS NULL
  AND t.category_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM recipients r
    WHERE r.name = COALESCE(t.recipient_name, t.description, 'Unknown')
      AND r.category_group_id = c.category_group_id
  )
ON CONFLICT DO NOTHING;

-- Step 8: Update these transactions with recipient_id
UPDATE transactions
SET recipient_id = subq.recipient_id
FROM (
  SELECT
    t.id as transaction_id,
    r.id as recipient_id
  FROM transactions t
  INNER JOIN categories c ON c.id = t.category_id
  INNER JOIN recipients r ON r.name = COALESCE(t.recipient_name, t.description, 'Unknown')
    AND r.category_group_id = c.category_group_id
  WHERE t.recipient_id IS NULL
    AND t.category_id IS NOT NULL
) subq
WHERE transactions.id = subq.transaction_id;

-- Step 9: Drop unique constraint on recipients.name
ALTER TABLE recipients DROP CONSTRAINT IF EXISTS recipients_name_key;

-- Step 10: Drop default_category_id column from recipients
ALTER TABLE recipients DROP COLUMN IF EXISTS default_category_id;

-- Step 11: Make category_group_id NOT NULL in recipients
UPDATE recipients SET category_group_id = (SELECT id FROM category_groups LIMIT 1)
WHERE category_group_id IS NULL;

ALTER TABLE recipients ALTER COLUMN category_group_id SET NOT NULL;

-- Step 12: Add unique constraint on (category_group_id, name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recipients_category_group_id_name_key'
  ) THEN
    ALTER TABLE recipients ADD CONSTRAINT recipients_category_group_id_name_key
      UNIQUE (category_group_id, name);
  END IF;
END $$;

-- Step 13: Drop category_id from transactions
ALTER TABLE transactions DROP COLUMN IF EXISTS category_id;

-- Step 14: Drop budget_lines table
DROP TABLE IF EXISTS budget_lines CASCADE;

-- Step 15: Drop categories table
DROP TABLE IF EXISTS categories CASCADE;

-- Step 16: Drop old indexes
DROP INDEX IF EXISTS idx_categories_group;
DROP INDEX IF EXISTS idx_transactions_category;

-- Step 17: Create new indexes for recipients
CREATE INDEX IF NOT EXISTS idx_recipients_category_group ON recipients(category_group_id);
CREATE INDEX IF NOT EXISTS idx_recipients_name_idx ON recipients(name);