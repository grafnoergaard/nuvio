insert into public.push_notification_configs (
  key,
  is_enabled,
  auto_send_enabled,
  schedule_type,
  send_day_of_week,
  send_day_of_month,
  send_hour,
  send_minute,
  timezone,
  message_title,
  message_body,
  trigger_condition,
  delivery_window_start_hour,
  delivery_window_end_hour
)
values (
  'week_transition',
  true,
  false,
  'weekly',
  1,
  null,
  11,
  0,
  'Europe/Copenhagen',
  'Ugens Kuvert er klar',
  'Se hvordan sidste uge landede - og hvad dit bedste næste skridt er.',
  'both',
  9,
  20
)
on conflict (key) do nothing;
