/*
  # Add is_burger column to mobile_nav_slots

  ## Summary
  Adds an `is_burger` boolean column to `mobile_nav_slots` so that any slot can
  optionally be configured as the burger-menu toggle button, instead of it being
  hardcoded as the last fixed slot.

  ## Changes
  - `mobile_nav_slots`: new column `is_burger` (boolean, default false)

  ## Notes
  - When `is_burger = true` the slot renders as the burger/menu toggle button
  - `nav_item_id` should be null when `is_burger = true`
  - Existing rows default to false (no burger slot assigned)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mobile_nav_slots' AND column_name = 'is_burger'
  ) THEN
    ALTER TABLE mobile_nav_slots ADD COLUMN is_burger boolean NOT NULL DEFAULT false;
  END IF;
END $$;
