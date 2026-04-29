-- Harden exposed functions and trigger functions flagged by Supabase security linter.

-- 1) Push trigger helpers: explicit search_path and no implicit role-mutable lookup.
create or replace function public.set_push_notification_configs_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_push_notification_user_state_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2) Budget switching is intentionally callable by signed-in users,
-- but it does not need SECURITY DEFINER because authenticated users
-- already have update access on budgets under current RLS policies.
create or replace function public.set_active_budget(budget_uuid uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update budgets set is_active = false where is_active = true;
  update budgets set is_active = true where id = budget_uuid;
end;
$$;

revoke execute on function public.set_active_budget(uuid) from anon;

-- 3) Typography trigger helper should only be used by its trigger.
create or replace function public.update_typography_tokens_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.update_typography_tokens_updated_at() from public;
revoke execute on function public.update_typography_tokens_updated_at() from anon;
revoke execute on function public.update_typography_tokens_updated_at() from authenticated;
