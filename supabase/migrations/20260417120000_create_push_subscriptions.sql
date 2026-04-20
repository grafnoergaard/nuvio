create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  is_active boolean not null default true,
  failure_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz,
  last_sent_at timestamptz,
  failed_at timestamptz
);

create unique index if not exists push_subscriptions_endpoint_key
  on public.push_subscriptions(endpoint);

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions(user_id, is_active);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can read own push subscriptions" on public.push_subscriptions;
create policy "Users can read own push subscriptions"
  on public.push_subscriptions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own push subscriptions" on public.push_subscriptions;
create policy "Users can insert own push subscriptions"
  on public.push_subscriptions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own push subscriptions" on public.push_subscriptions;
create policy "Users can update own push subscriptions"
  on public.push_subscriptions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own push subscriptions" on public.push_subscriptions;
create policy "Users can delete own push subscriptions"
  on public.push_subscriptions
  for delete
  to authenticated
  using (auth.uid() = user_id);
