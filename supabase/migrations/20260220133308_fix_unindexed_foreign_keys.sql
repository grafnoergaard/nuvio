
/*
  # Fix unindexed foreign keys and drop unused index

  1. New indexes
    - `idx_mini_checkup_settings_updated_by` on `mini_checkup_settings(updated_by)`
    - `idx_nav_items_plan_sub_group_id` on `nav_items(plan_sub_group_id)`
    - `idx_nav_plan_sub_items_sub_group_id` on `nav_plan_sub_items(sub_group_id)`
    - `idx_recipient_rules_recipient_id` on `recipient_rules(recipient_id)`

  2. Removed indexes
    - `idx_mini_checkup_user_state_user_id` — reported as unused
*/

CREATE INDEX IF NOT EXISTS idx_mini_checkup_settings_updated_by
  ON public.mini_checkup_settings(updated_by);

CREATE INDEX IF NOT EXISTS idx_nav_items_plan_sub_group_id
  ON public.nav_items(plan_sub_group_id);

CREATE INDEX IF NOT EXISTS idx_nav_plan_sub_items_sub_group_id
  ON public.nav_plan_sub_items(sub_group_id);

CREATE INDEX IF NOT EXISTS idx_recipient_rules_recipient_id
  ON public.recipient_rules(recipient_id);

DROP INDEX IF EXISTS public.idx_mini_checkup_user_state_user_id;
