/*
  # Ferie mode foundation

  Adds the core data model needed to know whether a user is in normal Kuvert,
  has a planned feriekuvert, or is actively using ferie mode.
*/

do $$
begin
  create type public.vacation_mode_status as enum ('planned', 'active', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.expense_mode as enum ('normal', 'vacation');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.vacation_modes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.vacation_mode_status not null default 'planned',
  budget_amount numeric(12,2) not null check (budget_amount >= 0),
  start_date date not null,
  end_date date not null,
  number_of_days integer not null check (number_of_days > 0),
  activated_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vacation_modes_valid_date_range check (end_date >= start_date),
  constraint vacation_modes_number_of_days_matches_range check (number_of_days = (end_date - start_date + 1))
);

create unique index if not exists idx_vacation_modes_one_active_per_user
  on public.vacation_modes(user_id)
  where status = 'active';

create index if not exists idx_vacation_modes_user_status_dates
  on public.vacation_modes(user_id, status, start_date, end_date);

create or replace function public.set_vacation_modes_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_vacation_modes_updated_at on public.vacation_modes;
create trigger trg_vacation_modes_updated_at
before update on public.vacation_modes
for each row
execute function public.set_vacation_modes_updated_at();

alter table public.vacation_modes enable row level security;

drop policy if exists "Users can delete own vacation modes" on public.vacation_modes;
drop policy if exists "Users can insert own vacation modes" on public.vacation_modes;
drop policy if exists "Users can select own vacation modes" on public.vacation_modes;
drop policy if exists "Users can update own vacation modes" on public.vacation_modes;

create policy "Users can delete own vacation modes"
  on public.vacation_modes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own vacation modes"
  on public.vacation_modes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can select own vacation modes"
  on public.vacation_modes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can update own vacation modes"
  on public.vacation_modes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.quick_expenses
  add column if not exists mode public.expense_mode not null default 'normal',
  add column if not exists vacation_mode_id uuid references public.vacation_modes(id) on delete set null;

create index if not exists idx_quick_expenses_user_mode_date
  on public.quick_expenses(user_id, mode, expense_date);

create index if not exists idx_quick_expenses_vacation_mode_id
  on public.quick_expenses(vacation_mode_id);
