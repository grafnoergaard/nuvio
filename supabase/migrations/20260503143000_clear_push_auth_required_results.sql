update public.push_notification_configs
set
  last_result = 'Intern push-url rettet - afventer næste kørsel',
  last_sent_at = null,
  updated_at = now()
where
  last_result is not null
  and (
    lower(last_result) like '%authentication required%'
    or lower(last_result) like '%http 401:%'
  );
