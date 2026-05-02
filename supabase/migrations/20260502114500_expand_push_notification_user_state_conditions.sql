do $$
declare
  constraint_name text;
begin
  select conname
  into constraint_name
  from pg_constraint
  where conrelid = 'public.push_notification_user_state'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%last_sent_condition%'
  limit 1;

  if constraint_name is not null then
    execute format(
      'alter table public.push_notification_user_state drop constraint %I',
      constraint_name
    );
  end if;
end $$;

alter table public.push_notification_user_state
  add constraint push_notification_user_state_last_sent_condition_check
  check (
    last_sent_condition is null
    or last_sent_condition in (
      'ahead',
      'close',
      'over',
      'caution',
      'risk',
      'strong',
      'very_strong',
      'near_perfect',
      'grounded',
      'random_foundation',
      'random_method'
    )
  );
