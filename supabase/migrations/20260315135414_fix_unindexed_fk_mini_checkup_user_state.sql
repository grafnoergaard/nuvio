/*
  # Fix unindexed foreign key on mini_checkup_user_state

  ## Summary
  Adds a covering index on the `user_id` column of `mini_checkup_user_state`
  to back the foreign key `mini_checkup_user_state_user_id_fkey`.
  Without this index, any lookup or join via user_id performs a full table scan.

  ## Changes
  - New index: `idx_mini_checkup_user_state_user_id` on `public.mini_checkup_user_state(user_id)`
*/

CREATE INDEX IF NOT EXISTS idx_mini_checkup_user_state_user_id
  ON public.mini_checkup_user_state(user_id);
