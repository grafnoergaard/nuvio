alter table public.push_notification_configs
  add column if not exists message_title text,
  add column if not exists message_body text;

update public.push_notification_configs
set
  message_title = case key
    when 'test_all_users' then 'Kuvert test'
    when 'weekly_budget_reminder' then 'Ugens Kuvert'
    when 'streak_risk' then 'Pas på din rytme'
    when 'month_close' then 'Måneden lukker snart'
    else coalesce(message_title, 'Kuvert')
  end,
  message_body = case key
    when 'test_all_users' then 'Det her er en test fra admin. Nu ved vi, at push-laget virker.'
    when 'weekly_budget_reminder' then 'Se hvor du står i denne uge - og hvad dit bedste næste skridt er.'
    when 'streak_risk' then 'Et hurtigt tjek nu kan hjælpe dig med at holde uge-rytmen i live.'
    when 'month_close' then 'Tag et roligt kig på Kuvert nu, så du lander godt i slutningen af måneden.'
    else coalesce(message_body, 'Husk at tjekke din Kuvert i dag.')
  end
where message_title is null or message_body is null;
