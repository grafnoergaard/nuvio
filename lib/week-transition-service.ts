import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';
import {
  getWeeksInMonth,
  computeWeeklyCarryOver,
  type QuickExpense,
  type QuickExpenseMonthlyBudget,
} from './quick-expense-service';

export interface WeekTransition {
  id: string;
  user_id: string;
  year: number;
  month: number;
  week_number: number;
  budget_amount: number;
  total_spent: number;
  carry_over: number;
  transaction_count: number;
  acknowledged_at: string | null;
  ai_summary: string | null;
  dismiss_count: number;
  created_at: string;
}

export interface WeekSummaryData {
  year: number;
  month: number;
  weekNumber: number;
  isoWeekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  budgetAmount: number;
  totalSpent: number;
  carryOver: number;
  transactionCount: number;
  nextWeekBudget: number;
  avgTransactionsPerWeek: number | null;
}

export interface WeekAiAnalysis {
  message: string;
  focusNextWeek: string;
  tone: 'positive' | 'neutral' | 'warning' | 'critical';
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getCurrentWeekIndex(
  year: number,
  month: number,
  today: Date,
  weekStartDay: number
): number {
  const weeks = getWeeksInMonth(year, month, weekStartDay);
  const todayStr = toDateString(today);
  return weeks.findIndex(
    ({ start, end }) => todayStr >= toDateString(start) && todayStr <= toDateString(end)
  );
}

export function getPreviousWeekInfo(
  year: number,
  month: number,
  today: Date,
  weekStartDay: number
): { year: number; month: number; weekNumber: number; weekStart: Date; weekEnd: Date } | null {
  const weeks = getWeeksInMonth(year, month, weekStartDay);
  const currentIdx = getCurrentWeekIndex(year, month, today, weekStartDay);

  if (currentIdx <= 0) {
    if (month === 1) return null;
    const prevMonth = month - 1;
    const prevYear = year;
    const prevWeeks = getWeeksInMonth(prevYear, prevMonth, weekStartDay);
    if (prevWeeks.length === 0) return null;
    const lastWeek = prevWeeks[prevWeeks.length - 1];
    return {
      year: prevYear,
      month: prevMonth,
      weekNumber: prevWeeks.length,
      weekStart: lastWeek.start,
      weekEnd: lastWeek.end,
    };
  }

  const prevWeek = weeks[currentIdx - 1];
  return {
    year,
    month,
    weekNumber: currentIdx,
    weekStart: prevWeek.start,
    weekEnd: prevWeek.end,
  };
}

export async function getWeekTransition(
  year: number,
  month: number,
  weekNumber: number
): Promise<WeekTransition | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('quick_expense_week_transitions')
    .select('*')
    .eq('user_id', user.id)
    .eq('year', year)
    .eq('month', month)
    .eq('week_number', weekNumber)
    .maybeSingle();

  if (error) throw error;
  return data as WeekTransition | null;
}

export async function hasAcknowledgedWeekTransition(
  year: number,
  month: number,
  weekNumber: number
): Promise<boolean> {
  const transition = await getWeekTransition(year, month, weekNumber);
  return transition !== null && transition.acknowledged_at !== null;
}

export async function upsertWeekTransition(
  year: number,
  month: number,
  weekNumber: number,
  budgetAmount: number,
  totalSpent: number,
  carryOver: number,
  transactionCount: number
): Promise<WeekTransition> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('quick_expense_week_transitions')
    .upsert(
      {
        user_id: user.id,
        year,
        month,
        week_number: weekNumber,
        budget_amount: budgetAmount,
        total_spent: totalSpent,
        carry_over: carryOver,
        transaction_count: transactionCount,
      },
      { onConflict: 'user_id,year,month,week_number' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as WeekTransition;
}

export async function acknowledgeWeekTransition(
  year: number,
  month: number,
  weekNumber: number,
  aiSummary?: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('quick_expense_week_transitions')
    .update({
      acknowledged_at: new Date().toISOString(),
      ...(aiSummary !== undefined ? { ai_summary: aiSummary } : {}),
    })
    .eq('user_id', user.id)
    .eq('year', year)
    .eq('month', month)
    .eq('week_number', weekNumber);

  if (error) throw error;
}

export async function saveAiSummary(
  year: number,
  month: number,
  weekNumber: number,
  aiSummary: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('quick_expense_week_transitions')
    .update({ ai_summary: aiSummary })
    .eq('user_id', user.id)
    .eq('year', year)
    .eq('month', month)
    .eq('week_number', weekNumber);

  if (error) throw error;
}

export async function computeWeekSummaryData(
  year: number,
  month: number,
  weekNumber: number,
  weekStart: Date,
  weekEnd: Date,
  expenses: QuickExpense[],
  monthlyBudget: QuickExpenseMonthlyBudget | null,
  weekStartDay: number
): Promise<WeekSummaryData> {
  const budgetAmount = monthlyBudget?.budget_amount ?? 0;

  const startStr = toDateString(weekStart);
  const endStr = toDateString(weekEnd);
  const weekExpenses = expenses.filter(
    e => e.expense_date >= startStr && e.expense_date <= endStr
  );
  const actualTotalSpent = weekExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const transactionCount = weekExpenses.length;

  const summary = computeWeeklyCarryOver(
    budgetAmount,
    year,
    month,
    expenses,
    weekEnd,
    weekStartDay
  );

  const thisWeek = summary.weeks.find(w => w.weekNumber === weekNumber);
  const weekBudget = thisWeek?.effectiveBudget ?? summary.weeklyBase;
  const totalSpent = thisWeek?.spent ?? actualTotalSpent;
  const carryOver = weekBudget - totalSpent;

  const weeks = getWeeksInMonth(year, month, weekStartDay);
  const nextWeekIndex = weekNumber;
  let nextWeekBudget = summary.weeklyBase;
  if (nextWeekIndex < weeks.length) {
    const nextWeekSummary = computeWeeklyCarryOver(
      budgetAmount,
      year,
      month,
      expenses,
      weeks[nextWeekIndex].start,
      weekStartDay
    );
    const nextWeek = nextWeekSummary.weeks.find(w => w.weekNumber === weekNumber + 1);
    nextWeekBudget = nextWeek?.effectiveBudget ?? summary.weeklyBase;
  }

  const allWeekTransactions = weeks.map(({ start, end }, idx) => {
    const s = toDateString(start);
    const e = toDateString(end);
    const count = expenses.filter(ex => ex.expense_date >= s && ex.expense_date <= e).length;
    return { weekIdx: idx, count };
  });

  const completedWeeks = allWeekTransactions.filter(
    w => w.weekIdx < weekNumber - 1 && w.count > 0
  );
  const avgTransactionsPerWeek =
    completedWeeks.length > 0
      ? completedWeeks.reduce((sum, w) => sum + w.count, 0) / completedWeeks.length
      : null;

  return {
    year,
    month,
    weekNumber,
    isoWeekNumber: getISOWeekNumber(weekStart),
    weekStart,
    weekEnd,
    budgetAmount: weekBudget,
    totalSpent,
    carryOver,
    transactionCount,
    nextWeekBudget,
    avgTransactionsPerWeek,
  };
}

export async function incrementDismissCount(
  year: number,
  month: number,
  weekNumber: number
): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const existing = await getWeekTransition(year, month, weekNumber);
  const newCount = (existing?.dismiss_count ?? 0) + 1;

  const { error } = await supabase
    .from('quick_expense_week_transitions')
    .update({ dismiss_count: newCount })
    .eq('user_id', user.id)
    .eq('year', year)
    .eq('month', month)
    .eq('week_number', weekNumber);

  if (error) throw error;
  return newCount;
}

export async function getMonthlyAccumulatedSavings(
  year: number,
  month: number
): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('quick_expense_week_transitions')
    .select('budget_amount, total_spent')
    .eq('user_id', user.id)
    .eq('year', year)
    .eq('month', month);

  if (error) throw error;
  if (!data || data.length === 0) return 0;

  return data.reduce((sum, row) => sum + (row.budget_amount - row.total_spent), 0);
}

export async function fetchWeekAiAnalysis(
  summaryData: WeekSummaryData,
  _accessToken?: string
): Promise<WeekAiAnalysis> {
  const DANISH_MONTHS = [
    'januar', 'februar', 'marts', 'april', 'maj', 'juni',
    'juli', 'august', 'september', 'oktober', 'november', 'december',
  ];
  const monthName = DANISH_MONTHS[summaryData.month - 1];

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? supabaseAnonKey;

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-assistant`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      context: {
        page: 'week-transition',
        year: summaryData.year,
        month: summaryData.month,
        monthName,
        weekNumber: summaryData.weekNumber,
        budgetAmount: summaryData.budgetAmount,
        totalSpent: summaryData.totalSpent,
        carryOver: summaryData.carryOver,
        transactionCount: summaryData.transactionCount,
        nextWeekBudget: summaryData.nextWeekBudget,
        avgTransactionsPerWeek: summaryData.avgTransactionsPerWeek,
      },
    }),
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errData = await response.json();
      errorDetail = errData?.error ?? errData?.message ?? '';
    } catch { /* ignore */ }
    throw new Error(`AI-kald fejlede (${response.status}): ${errorDetail}`);
  }

  const data = await response.json();
  return {
    message: data.message ?? '',
    focusNextWeek: data.actions?.[0]?.description ?? '',
    tone: data.tone ?? 'neutral',
  };
}
