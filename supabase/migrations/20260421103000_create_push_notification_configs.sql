create table if not exists public.push_notification_configs (
  key text primary key,
  is_enabled boolean not null default true,
  auto_send_enabled boolean not null default false,
  schedule_type text not null default 'manual'
    check (schedule_type in ('manual', 'weekly', 'monthly')),
  send_day_of_week smallint null
    check (send_day_of_week between 0 and 6),
  send_day_of_month smallint null
    check (send_day_of_month between 1 and 31),
  send_hour smallint not null default 9
    check (send_hour between 0 and 23),
  send_minute smallint not null default 0
    check (send_minute between 0 and 59),
  timezone text not null default 'Europe/Copenhagen',
  last_sent_at timestamptz null,
  last_result text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_push_notification_configs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_push_notification_configs_updated_at on public.push_notification_configs;
create trigger trg_push_notification_configs_updated_at
before update on public.push_notification_configs
for each row
execute function public.set_push_notification_configs_updated_at();

insert into public.push_notification_configs (
  key,
  is_enabled,
  auto_send_enabled,
  schedule_type,
  send_day_of_week,
  send_day_of_month,
  send_hour,
  send_minute,
  timezone
)
values
  ('test_all_users', true, false, 'manual', null, null, 9, 0, 'Europe/Copenhagen'),
  ('weekly_budget_reminder', true, false, 'weekly', 3, null, 11, 0, 'Europe/Copenhagen'),
  ('streak_risk', true, false, 'weekly', 4, null, 16, 0, 'Europe/Copenhagen'),
  ('month_close', true, false, 'monthly', null, 25, 9, 0, 'Europe/Copenhagen')
on conflict (key) do nothing;
