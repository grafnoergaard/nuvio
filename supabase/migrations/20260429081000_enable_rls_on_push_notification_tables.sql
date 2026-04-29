-- Lock down internal push tables.
-- These tables are only used through server-side routes with service_role,
-- so authenticated/anonymous clients should not access them directly.

alter table if exists public.push_notification_configs
  enable row level security;

alter table if exists public.push_notification_user_state
  enable row level security;

-- Intentionally no client-facing policies.
-- service_role bypasses RLS for admin/server automation.
