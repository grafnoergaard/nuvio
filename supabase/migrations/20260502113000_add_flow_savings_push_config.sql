insert into public.push_notification_configs (
  key,
  is_enabled,
  auto_send_enabled,
  message_title,
  message_body,
  schedule_type,
  send_day_of_week,
  send_day_of_month,
  send_hour,
  send_minute,
  timezone,
  trigger_condition,
  delivery_window_start_hour,
  delivery_window_end_hour
)
values (
  'flow_savings',
  true,
  false,
  'Der er penge til Sparet',
  'Sidste uge landede med overskud. Flyt beløbet til Sparet, mens rytmen stadig er frisk.',
  'weekly',
  1,
  null,
  11,
  0,
  'Europe/Copenhagen',
  'both',
  9,
  20
)
on conflict (key) do nothing;
