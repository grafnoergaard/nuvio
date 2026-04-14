/*
  # Add is_visible_to_users to nav_items

  ## Summary
  Adds a visibility flag to nav_items that controls whether a navigation item
  is shown to regular (non-admin) users. Admins always see all items regardless
  of this flag.

  ## Changes
  ### Modified Tables
  - `nav_items`
    - New column: `is_visible_to_users` (boolean, DEFAULT true)
      - `true` = visible to all users (default, backwards compatible)
      - `false` = hidden from non-admin users; admins still see it

  ## Notes
  - Defaults to true so all existing nav items remain visible after migration
  - No data loss; purely additive change
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nav_items' AND column_name = 'is_visible_to_users'
  ) THEN
    ALTER TABLE nav_items ADD COLUMN is_visible_to_users boolean NOT NULL DEFAULT true;
  END IF;
END $$;
