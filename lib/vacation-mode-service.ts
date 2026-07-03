import { supabase } from './supabase';

export const VACATION_MODE_STATUSES = ['planned', 'active', 'completed', 'cancelled'] as const;
export type VacationModeStatus = (typeof VACATION_MODE_STATUSES)[number];

export type ExpenseMode = 'normal' | 'vacation';
export type MoneyModeKind = 'normal' | 'planned_vacation' | 'vacation';

export interface VacationMode {
  id: string;
  user_id: string;
  status: VacationModeStatus;
  budget_amount: number;
  start_date: string;
  end_date: string;
  number_of_days: number;
  activated_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CurrentMoneyMode =
  | {
      mode: 'vacation';
      activeVacationMode: VacationMode;
      plannedVacationMode: null;
    }
  | {
      mode: 'planned_vacation';
      activeVacationMode: null;
      plannedVacationMode: VacationMode;
    }
  | {
      mode: 'normal';
      activeVacationMode: null;
      plannedVacationMode: null;
    };

type SupabaseLike = {
  from: (table: string) => any;
};

export function todayIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDaysToIsoDate(value: string, days: number): string {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return todayIsoDate(date);
}

export function getInclusiveVacationDays(startDate: string, endDate: string): number {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.round(diff / 86_400_000) + 1);
}

export async function getActiveVacationMode(
  userId: string,
  client: SupabaseLike = supabase
): Promise<VacationMode | null> {
  const { data, error } = await client
    .from('vacation_modes')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('activated_at', { ascending: false, nullsFirst: false })
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as VacationMode | null;
}

export async function getPlannedVacationMode(
  userId: string,
  client: SupabaseLike = supabase
): Promise<VacationMode | null> {
  const { data, error } = await client
    .from('vacation_modes')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'planned')
    .gte('end_date', todayIsoDate())
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as VacationMode | null;
}

export async function getReadyVacationMode(
  userId: string,
  client: SupabaseLike = supabase
): Promise<VacationMode | null> {
  const today = todayIsoDate();
  const { data, error } = await client
    .from('vacation_modes')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'planned')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as VacationMode | null;
}

export async function activateVacationMode(
  vacationModeId: string,
  userId: string,
  client: SupabaseLike = supabase
): Promise<VacationMode> {
  const { data, error } = await client
    .from('vacation_modes')
    .update({
      status: 'active',
      activated_at: new Date().toISOString(),
    })
    .eq('id', vacationModeId)
    .eq('user_id', userId)
    .eq('status', 'planned')
    .select('*')
    .single();

  if (error) throw error;
  return data as VacationMode;
}

export async function updateVacationMode(
  vacationModeId: string,
  userId: string,
  input: {
    budget_amount: number;
    start_date: string;
    end_date: string;
    number_of_days: number;
  },
  client: SupabaseLike = supabase
): Promise<VacationMode> {
  const { data, error } = await client
    .from('vacation_modes')
    .update({
      budget_amount: input.budget_amount,
      start_date: input.start_date,
      end_date: input.end_date,
      number_of_days: input.number_of_days,
      updated_at: new Date().toISOString(),
    })
    .eq('id', vacationModeId)
    .eq('user_id', userId)
    .in('status', ['planned', 'active'])
    .select('*')
    .single();

  if (error) throw error;
  return data as VacationMode;
}

export async function upsertPlannedVacationMode(
  userId: string,
  input: {
    budget_amount: number;
    start_date: string;
    end_date: string;
    number_of_days: number;
  },
  client: SupabaseLike = supabase
): Promise<VacationMode> {
  const existing = await getPlannedVacationMode(userId, client);

  if (existing) {
    const { data, error } = await client
      .from('vacation_modes')
      .update({
        budget_amount: input.budget_amount,
        start_date: input.start_date,
        end_date: input.end_date,
        number_of_days: input.number_of_days,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('user_id', userId)
      .eq('status', 'planned')
      .select('*')
      .single();

    if (error) throw error;
    return data as VacationMode;
  }

  const { data, error } = await client
    .from('vacation_modes')
    .insert({
      user_id: userId,
      status: 'planned',
      budget_amount: input.budget_amount,
      number_of_days: input.number_of_days,
      start_date: input.start_date,
      end_date: input.end_date,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as VacationMode;
}

export async function cancelVacationMode(
  vacationModeId: string,
  userId: string,
  client: SupabaseLike = supabase
): Promise<VacationMode> {
  const { data, error } = await client
    .from('vacation_modes')
    .update({
      status: 'cancelled',
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', vacationModeId)
    .eq('user_id', userId)
    .eq('status', 'planned')
    .select('*')
    .single();

  if (error) throw error;
  return data as VacationMode;
}

export function isVacationModeReadyToEnd(
  vacationMode: VacationMode | null,
  now: Date = new Date()
): boolean {
  if (!vacationMode || vacationMode.status !== 'active') return false;
  return vacationMode.end_date < todayIsoDate(now);
}

export async function completeVacationMode(
  vacationModeId: string,
  userId: string,
  client: SupabaseLike = supabase
): Promise<VacationMode> {
  const { data, error } = await client
    .from('vacation_modes')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', vacationModeId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .select('*')
    .single();

  if (error) throw error;
  return data as VacationMode;
}

export async function getCurrentMoneyMode(
  userId: string,
  client: SupabaseLike = supabase
): Promise<CurrentMoneyMode> {
  const activeVacationMode = await getActiveVacationMode(userId, client);

  if (activeVacationMode) {
    return {
      mode: 'vacation',
      activeVacationMode,
      plannedVacationMode: null,
    };
  }

  const plannedVacationMode = await getPlannedVacationMode(userId, client);

  if (plannedVacationMode) {
    return {
      mode: 'planned_vacation',
      activeVacationMode: null,
      plannedVacationMode,
    };
  }

  return {
    mode: 'normal',
    activeVacationMode: null,
    plannedVacationMode: null,
  };
}
