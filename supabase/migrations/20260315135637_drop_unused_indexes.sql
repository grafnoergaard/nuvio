/*
  # Drop unused indexes

  ## Summary
  Removes four indexes that have never been used by the query planner.
  Unused indexes waste storage and slow down write operations without
  providing any query performance benefit.

  ## Dropped Indexes
  1. `idx_mini_checkup_settings_updated_by` on `public.mini_checkup_settings`
  2. `idx_nav_items_plan_sub_group_id` on `public.nav_items`
  3. `idx_nav_plan_sub_items_sub_group_id` on `public.nav_plan_sub_items`
  4. `idx_recipient_rules_recipient_id` on `public.recipient_rules`

  ## Notes
  - No data is affected — indexes are not data
  - These can be recreated if query patterns change in the future
*/

DROP INDEX IF EXISTS public.idx_mini_checkup_settings_updated_by;
DROP INDEX IF EXISTS public.idx_nav_items_plan_sub_group_id;
DROP INDEX IF EXISTS public.idx_nav_plan_sub_items_sub_group_id;
DROP INDEX IF EXISTS public.idx_recipient_rules_recipient_id;
