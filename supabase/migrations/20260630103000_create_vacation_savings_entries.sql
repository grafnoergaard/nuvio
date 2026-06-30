create table if not exists public.vacation_savings_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vacation_mode_id uuid not null references public.vacation_modes(id) on delete cascade,
  amount numeric not null default 0 check (amount >= 0),
  budget_amount numeric not null default 0,
  total_spent numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, vacation_mode_id)
);

alter table public.vacation_savings_entries enable row level security;

create policy "Users can read own vacation savings entries"
  on public.vacation_savings_entries
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own vacation savings entries"
  on public.vacation_savings_entries
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own vacation savings entries"
  on public.vacation_savings_entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
