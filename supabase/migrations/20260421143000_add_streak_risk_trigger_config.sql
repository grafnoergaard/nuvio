alter table public.push_notification_configs
  add column if not exists trigger_condition text not null default 'both'
    check (trigger_condition in ('close', 'over', 'both')),
  add column if not exists delivery_window_start_hour smallint not null default 9
    check (delivery_window_start_hour between 0 and 23),
  add column if not exists delivery_window_end_hour smallint not null default 20
    check (delivery_window_end_hour between 0 and 23);

update public.push_notification_configs
set
  trigger_condition = 'both',
  delivery_window_start_hour = 9,
  delivery_window_end_hour = 20
where key = 'streak_risk';

create table if not exists public.push_notification_user_state (
  notification_key text not null,
  user_id uuid not null,
  last_sent_at timestamptz null,
  last_sent_week_key text null,
  last_sent_condition text null
    check (last_sent_condition in ('ahead', 'close', 'over')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (notification_key, user_id)
);

create or replace function public.set_push_notification_user_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_push_notification_user_state_updated_at on public.push_notification_user_state;
create trigger trg_push_notification_user_state_updated_at
before update on public.push_notification_user_state
for each row
execute function public.set_push_notification_user_state_updated_at();
