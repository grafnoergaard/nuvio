import { supabase } from './supabase';

export interface FlowSavingsEntry {
  id: string;
  user_id: string;
  year: number;
  month: number;
  week_number: number;
  amount: number;
  budget_amount: number;
  total_spent: number;
  created_at: string;
}

export interface FlowSavingsTotals {
  id: string;
  user_id: string;
  current_balance: number;
  lifetime_total: number;
  week_count: number;
  reset_count: number;
  last_reset_at: string | null;
  updated_at: string;
}

export async function getFlowSavingsTotals(): Promise<FlowSavingsTotals | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('flow_savings_totals')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data as FlowSavingsTotals | null;
}

export async function getFlowSavingsEntries(): Promise<FlowSavingsEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('flow_savings_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .order('week_number', { ascending: false });

  if (error) throw error;
  return (data ?? []) as FlowSavingsEntry[];
}

export async function hasFlowSavingsEntryForWeek(
  year: number,
  month: number,
  weekNumber: number
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('flow_savings_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('year', year)
    .eq('month', month)
    .eq('week_number', weekNumber)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

export async function recordFlowSavingsWeek(
  year: number,
  month: number,
  weekNumber: number,
  amount: number,
  budgetAmount: number,
  totalSpent: number
): Promise<{ entry: FlowSavingsEntry; totals: FlowSavingsTotals }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const safeAmount = Math.max(0, amount);

  const { data: existingEntry } = await supabase
    .from('flow_savings_entries')
    .select('id, amount')
    .eq('user_id', user.id)
    .eq('year', year)
    .eq('month', month)
    .eq('week_number', weekNumber)
    .maybeSingle();

  const previousAmount = existingEntry ? Number(existingEntry.amount) : 0;
  const isNewEntry = existingEntry === null;
  const amountDelta = safeAmount - previousAmount;

  const { data: entryData, error: entryError } = await supabase
    .from('flow_savings_entries')
    .upsert(
      {
        user_id: user.id,
        year,
        month,
        week_number: weekNumber,
        amount: safeAmount,
        budget_amount: budgetAmount,
        total_spent: totalSpent,
      },
      { onConflict: 'user_id,year,month,week_number' }
    )
    .select()
    .single();

  if (entryError) throw entryError;

  const existing = await getFlowSavingsTotals();

  let newCurrentBalance: number;
  let newLifetimeTotal: number;
  let newWeekCount: number;

  if (existing) {
    newCurrentBalance = existing.current_balance + amountDelta;
    newLifetimeTotal = existing.lifetime_total + amountDelta;
    newWeekCount = isNewEntry
      ? existing.week_count + (safeAmount > 0 ? 1 : 0)
      : existing.week_count;
  } else {
    newCurrentBalance = safeAmount;
    newLifetimeTotal = safeAmount;
    newWeekCount = safeAmount > 0 ? 1 : 0;
  }

  const { data: totalsData, error: totalsError } = await supabase
    .from('flow_savings_totals')
    .upsert(
      {
        user_id: user.id,
        current_balance: newCurrentBalance,
        lifetime_total: newLifetimeTotal,
        week_count: newWeekCount,
        reset_count: existing?.reset_count ?? 0,
        last_reset_at: existing?.last_reset_at ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (totalsError) throw totalsError;

  return {
    entry: entryData as FlowSavingsEntry,
    totals: totalsData as FlowSavingsTotals,
  };
}

export interface MissedFlowSavingsWeek {
  year: number;
  month: number;
  week_number: number;
  carry_over: number;
  budget_amount: number;
  total_spent: number;
}

export async function getMissedFlowSavingsWeeks(): Promise<MissedFlowSavingsWeek[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: acknowledged, error: ackError } = await supabase
    .from('quick_expense_week_transitions')
    .select('year, month, week_number, carry_over, budget_amount, total_spent')
    .eq('user_id', user.id)
    .not('acknowledged_at', 'is', null)
    .gt('carry_over', 0);

  if (ackError) throw ackError;
  if (!acknowledged || acknowledged.length === 0) return [];

  const { data: existingEntries, error: entryError } = await supabase
    .from('flow_savings_entries')
    .select('year, month, week_number')
    .eq('user_id', user.id);

  if (entryError) throw entryError;

  const entrySet = new Set(
    (existingEntries ?? []).map(e => `${e.year}-${e.month}-${e.week_number}`)
  );

  return acknowledged
    .filter(row => !entrySet.has(`${row.year}-${row.month}-${row.week_number}`))
    .map(row => ({
      year: row.year,
      month: row.month,
      week_number: row.week_number,
      carry_over: Number(row.carry_over),
      budget_amount: Number(row.budget_amount),
      total_spent: Number(row.total_spent),
    }));
}

export async function backfillMissedFlowSavings(): Promise<{ backfilledCount: number; totals: FlowSavingsTotals | null }> {
  const missed = await getMissedFlowSavingsWeeks();
  if (missed.length === 0) return { backfilledCount: 0, totals: await getFlowSavingsTotals() };

  let lastTotals: FlowSavingsTotals | null = null;
  for (const week of missed) {
    const result = await recordFlowSavingsWeek(
      week.year,
      week.month,
      week.week_number,
      week.carry_over,
      week.budget_amount,
      week.total_spent
    );
    lastTotals = result.totals;
  }

  return { backfilledCount: missed.length, totals: lastTotals };
}

export async function getMonthlyFlowSurplusEstimate(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const { data, error } = await supabase
    .from('flow_savings_entries')
    .select('amount, year, month')
    .eq('user_id', user.id)
    .gt('amount', 0)
    .gte('year', threeMonthsAgo.getFullYear());

  if (error || !data || data.length === 0) return 0;

  const filtered = data.filter(e => {
    const d = new Date(e.year, e.month - 1, 1);
    return d >= threeMonthsAgo;
  });

  if (filtered.length === 0) return 0;

  const byMonth = new Map<string, number>();
  for (const e of filtered) {
    const key = `${e.year}-${e.month}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(e.amount));
  }

  const monthlyTotals = Array.from(byMonth.values());
  const avg = monthlyTotals.reduce((s, v) => s + v, 0) / monthlyTotals.length;
  return Math.round(avg);
}

export interface SavingsMilestone {
  target: number;
  alreadyReached: boolean;
  weeksNeeded: number;
  progressPct: number;
  label: string;
}

export interface SavingsMilestonesResult {
  weeklyRate: number;
  milestones: SavingsMilestone[];
}

export async function computeSavingsMilestones(
  currentBalance: number,
  entries: FlowSavingsEntry[]
): Promise<SavingsMilestonesResult> {
  const MILESTONES = [10_000, 50_000, 100_000];

  const sortedEntries = [...entries].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    if (a.month !== b.month) return b.month - a.month;
    return b.week_number - a.week_number;
  });

  const recentEntries = sortedEntries.slice(0, 8);
  const positiveEntries = recentEntries.filter(e => e.amount > 0);

  let weeklyRate = 0;
  if (positiveEntries.length > 0) {
    const sum = positiveEntries.reduce((s, e) => s + Number(e.amount), 0);
    weeklyRate = sum / positiveEntries.length;
  }

  const milestones: SavingsMilestone[] = MILESTONES.map(target => {
    const alreadyReached = currentBalance >= target;
    if (alreadyReached) {
      return { target, alreadyReached: true, weeksNeeded: 0, progressPct: 100, label: '' };
    }
    const remaining = target - currentBalance;
    const weeksNeeded = weeklyRate > 0 ? Math.ceil(remaining / weeklyRate) : Infinity;
    const progressPct = Math.min(99, Math.round((currentBalance / target) * 100));
    const label = weeklyRate > 0 ? formatWeeksLabel(weeksNeeded) : '';
    return { target, alreadyReached: false, weeksNeeded, progressPct, label };
  });

  return { weeklyRate, milestones };
}

function formatWeeksLabel(weeks: number): string {
  if (!isFinite(weeks) || weeks <= 0) return '';
  const totalMonths = Math.round(weeks / 4.33);
  if (totalMonths < 1) return 'Om under 1 måned';
  if (totalMonths < 12) return `Om ca. ${totalMonths} ${totalMonths === 1 ? 'måned' : 'måneder'}`;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (months === 0) return `Om ca. ${years} ${years === 1 ? 'år' : 'år'}`;
  return `Om ca. ${years} år og ${months} ${months === 1 ? 'måned' : 'måneder'}`;
}

export async function resetFlowSavings(): Promise<FlowSavingsTotals> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const existing = await getFlowSavingsTotals();

  const { data, error } = await supabase
    .from('flow_savings_totals')
    .upsert(
      {
        user_id: user.id,
        current_balance: 0,
        lifetime_total: existing?.lifetime_total ?? 0,
        week_count: 0,
        reset_count: (existing?.reset_count ?? 0) + 1,
        last_reset_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('flow_savings_entries')
    .delete()
    .eq('user_id', user.id);

  return data as FlowSavingsTotals;
}
