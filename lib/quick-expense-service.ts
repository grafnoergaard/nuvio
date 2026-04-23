import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';

export interface MonthAiAnalysis {
  message: string;
  focusNextMonth: string;
  tone: 'positive' | 'neutral' | 'warning' | 'critical';
}

const DANISH_MONTHS_AI = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
];

export async function fetchMonthAiAnalysis(
  prevSummary: MonthSummary,
  currentStreak: number,
  longestStreak: number
): Promise<MonthAiAnalysis> {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? supabaseAnonKey;

  const monthName = DANISH_MONTHS_AI[prevSummary.month - 1];
  const savedAmount = prevSummary.budgetAmount - prevSummary.totalSpent;

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-assistant`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      context: {
        page: 'month-transition',
        year: prevSummary.year,
        month: prevSummary.month,
        monthName,
        budgetAmount: prevSummary.budgetAmount,
        totalSpent: prevSummary.totalSpent,
        savedAmount,
        wasOnBudget: prevSummary.wasOnBudget,
        expenseCount: prevSummary.expenseCount,
        currentStreak,
        longestStreak,
      },
    }),
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errData = await response.json();
      errorDetail = errData?.error ?? errData?.message ?? '';
    } catch { }
    throw new Error(`AI-kald fejlede (${response.status}): ${errorDetail}`);
  }

  const data = await response.json();
  return {
    message: data.message ?? '',
    focusNextMonth: data.actions?.[0]?.description ?? '',
    tone: data.tone ?? 'neutral',
  };
}

export interface QuickExpense {
  id: string;
  user_id: string;
  amount: number;
  note: string | null;
  expense_date: string;
  created_at: string;
  spread_over_month?: boolean | null;
}

export interface QuickExpenseBudget {
  id: string;
  user_id: string;
  monthly_budget: number;
  updated_at: string;
}

export interface QuickExpenseMonthlyBudget {
  id: string;
  user_id: string;
  year: number;
  month: number;
  budget_amount: number;
  weekly_carry_over: number;
  last_carry_over_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuickExpenseStreak {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  cumulative_score: number;
  last_evaluated_year: number | null;
  last_evaluated_month: number | null;
  updated_at: string;
}

export interface QuickExpenseWeeklyStreak {
  current_streak: number;
  longest_streak: number;
  evaluated_weeks: number;
  current_month_year: number;
  current_month: number;
  last_completed_week_start: string | null;
  last_completed_week_end: string | null;
  streak_weeks: Array<{
    iso_week_number: number;
    week_start: string;
    week_end: string;
  }>;
  current_month_weeks: Array<{
    iso_week_number: number;
    week_start: string;
    week_end: string;
    kept_budget: boolean | null;
    is_completed: boolean;
    is_current: boolean;
  }>;
}

const FLOW_SCORE_BASE_MONTHLY_REWARD = 100;
const FLOW_SCORE_STREAK_BONUS_PER_MONTH = 0.15;
const FLOW_SCORE_PENALTY_MIN = 50;
const FLOW_SCORE_PENALTY_PCT = 0.25;

export function computeRewardMonthScore(usageRatio?: number): number {
  if (usageRatio === undefined || usageRatio < 0 || usageRatio > 1) {
    return FLOW_SCORE_BASE_MONTHLY_REWARD;
  }

  if (usageRatio < 0.5) return 100;
  if (usageRatio < 0.75) return 90;
  if (usageRatio < 0.9) return 75;
  return 60;
}

export function computeQualityBonus(usageRatio: number): number {
  if (usageRatio < 0 || usageRatio > 1) return 0;
  if (usageRatio < 0.5) return 30;
  if (usageRatio < 0.75) return 50;
  if (usageRatio < 0.90) return 25;
  return 10;
}

export function computeMonthlyScoreDelta(
  wasOnBudget: boolean,
  currentStreak: number = 0,
  prevCumulativeScore: number = 0,
  usageRatio?: number
): number {
  if (!wasOnBudget) {
    const pctPenalty = Math.round(prevCumulativeScore * FLOW_SCORE_PENALTY_PCT);
    return -Math.max(FLOW_SCORE_PENALTY_MIN, pctPenalty);
  }
  const streakMultiplier = 1 + currentStreak * FLOW_SCORE_STREAK_BONUS_PER_MONTH;
  const qualityBonus = usageRatio !== undefined ? computeQualityBonus(usageRatio) : 0;
  const baseReward = computeRewardMonthScore(usageRatio) + qualityBonus;
  const reward = Math.round(baseReward * streakMultiplier);
  return Math.max(0, reward);
}

export function computeEndOfMonthFlowScore(
  totalSpent: number,
  budgetAmount: number,
  daysInMonth: number,
  flowScoreThreshold: number = 0.15
): number {
  if (budgetAmount <= 0) return 0;
  if (totalSpent > budgetAmount) return 0;
  const usageRatio = totalSpent / budgetAmount;
  const perfectThreshold = 1 - flowScoreThreshold;
  if (usageRatio <= 0) {
    return Math.round(100 * (1 + 1 / perfectThreshold));
  }
  if (usageRatio >= 1) return 0;
  const score = (perfectThreshold - usageRatio) / perfectThreshold;
  if (score <= 0) return Math.round((1 - usageRatio / perfectThreshold) * 100);
  return Math.max(0, Math.round((1 + score) * 100));
}

export interface MonthSummary {
  year: number;
  month: number;
  totalSpent: number;
  budgetAmount: number;
  expenseCount: number;
  wasOnBudget: boolean;
}

export interface WeeklyBudgetStatus {
  weekNumber: number;
  isoWeekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  weeklyBase: number;
  effectiveBudget: number;
  daysInMonth: number;
  spent: number;
  remaining: number;
  isOver: boolean;
  overageAmount: number;
  isCurrentWeek: boolean;
  isAhead: boolean;
  crossesMonthStart: boolean;
  crossesMonthEnd: boolean;
}

export interface WeeklyCarryOverSummary {
  weeklyBase: number;
  accumulatedCarryOver: number;
  effectiveWeeklyBudget: number;
  weeks: WeeklyBudgetStatus[];
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getWeeksInMonth(year: number, month: number, weekStartDay: number = 1): Array<{ start: Date; end: Date }> {
  const weeks: Array<{ start: Date; end: Date }> = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const dayOfWeek = firstDay.getDay();
  const daysFromWeekStart = (dayOfWeek - weekStartDay + 7) % 7;
  const customWeekStart = new Date(firstDay);
  customWeekStart.setDate(firstDay.getDate() - daysFromWeekStart);

  let weekStart = new Date(customWeekStart);

  while (weekStart <= lastDay) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const clampedStart = weekStart < firstDay ? new Date(firstDay) : new Date(weekStart);
    const clampedEnd = weekEnd > lastDay ? new Date(lastDay) : new Date(weekEnd);

    weeks.push({ start: clampedStart, end: clampedEnd });
    weekStart.setDate(weekStart.getDate() + 7);
  }

  return weeks;
}

export function computeWeeklyCarryOver(
  monthlyBudget: number,
  year: number,
  month: number,
  expenses: QuickExpense[],
  today: Date,
  weekStartDay: number = 1
): WeeklyCarryOverSummary {
  const daysInMonth = new Date(year, month, 0).getDate();
  const dailyRate = monthlyBudget / daysInMonth;
  const weeklyBase = dailyRate * 7;

  const weeks = getWeeksInMonth(year, month, weekStartDay);
  const totalWeeks = weeks.length;

  const daysPerWeek: number[] = weeks.map(({ start, end }) =>
    Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  );

  const basePerWeek: number[] = daysPerWeek.map(days => dailyRate * days);

  const spentPerWeek: number[] = weeks.map(({ start, end }, i) => {
    const startStr = toDateString(start);
    const endStr = toDateString(end);
    const daysInWeek = daysPerWeek[i];

    return expenses.reduce((sum, e) => {
      const amount = Number(e.amount);
      if (Boolean(e.spread_over_month)) {
        return sum + (amount / daysInMonth) * daysInWeek;
      }
      if (e.expense_date >= startStr && e.expense_date <= endStr) {
        return sum + amount;
      }
      return sum;
    }, 0);
  });

  const todayStr = toDateString(today);
  const isCurrentWeekArr = weeks.map(({ start, end }) =>
    toDateString(today) >= toDateString(start) && toDateString(today) <= toDateString(end)
  );
  const isPastWeekArr = weeks.map(({ end }, i) => toDateString(end) < todayStr && !isCurrentWeekArr[i]);

  let totalOverageFromPastWeeks = 0;
  for (let i = 0; i < totalWeeks; i++) {
    if (!isPastWeekArr[i]) continue;
    const overage = spentPerWeek[i] - basePerWeek[i];
    if (overage > 0) {
      totalOverageFromPastWeeks += overage;
    }
  }

  const currentWeekIndex = isCurrentWeekArr.findIndex(v => v);
  const remainingWeeksCount = currentWeekIndex >= 0
    ? totalWeeks - currentWeekIndex
    : 0;

  const overagePerRemainingWeek = remainingWeeksCount > 0
    ? totalOverageFromPastWeeks / remainingWeeksCount
    : 0;

  const weekStatuses: WeeklyBudgetStatus[] = weeks.map(({ start, end }, i) => {
    const isCurrentWeek = isCurrentWeekArr[i];
    const isPastWeek = isPastWeekArr[i];
    const spent = spentPerWeek[i];
    const isFutureWeek = !isCurrentWeek && !isPastWeek;

    const daysInWeek = daysPerWeek[i];
    const baseForThisWeek = basePerWeek[i];
    const isPartialWeek = daysInWeek < 7;

    const crossesMonthStart = i === 0 && isPartialWeek && start.getDay() !== weekStartDay && start.getDate() === 1;
    const crossesMonthEnd = i === totalWeeks - 1 && isPartialWeek;

    let effectiveBudget: number;
    if (isPastWeek) {
      effectiveBudget = baseForThisWeek;
    } else {
      effectiveBudget = baseForThisWeek - overagePerRemainingWeek;
    }

    const remaining = effectiveBudget - spent;
    const isOver = !isFutureWeek && spent > effectiveBudget;
    const overageAmount = isOver ? spent - effectiveBudget : 0;
    const isAhead = !isFutureWeek && !isOver && spent < effectiveBudget;

    return {
      weekNumber: i + 1,
      isoWeekNumber: getISOWeekNumber(end),
      weekStart: start,
      weekEnd: end,
      weeklyBase: baseForThisWeek,
      effectiveBudget,
      daysInMonth: daysInWeek,
      spent,
      remaining,
      isOver,
      overageAmount,
      isCurrentWeek,
      isAhead,
      crossesMonthStart,
      crossesMonthEnd,
    };
  });

  const accumulatedCarryOver = -totalOverageFromPastWeeks;
  const effectiveWeeklyBudget = weeklyBase - overagePerRemainingWeek;

  return {
    weeklyBase,
    accumulatedCarryOver,
    effectiveWeeklyBudget,
    weeks: weekStatuses,
  };
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getQuickExpensesForMonth(year: number, month: number): Promise<QuickExpense[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0);
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('quick_expenses')
    .select('*')
    .eq('user_id', user.id)
    .gte('expense_date', start)
    .lte('expense_date', end)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as QuickExpense[];
}

export async function addQuickExpense(amount: number, note: string | null, spreadOverMonth: boolean = false): Promise<QuickExpense> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('quick_expenses')
    .insert({
      user_id: user.id,
      amount,
      note,
      spread_over_month: spreadOverMonth,
      expense_date: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();

  if (error) throw error;
  return data as QuickExpense;
}

export async function updateQuickExpense(
  id: string,
  amount: number,
  expenseDate: string,
  spreadOverMonth?: boolean
): Promise<QuickExpense> {
  const updatePayload: Record<string, unknown> = {
    amount,
    expense_date: expenseDate,
  };

  if (typeof spreadOverMonth === 'boolean') {
    updatePayload.spread_over_month = spreadOverMonth;
  }

  const { data, error } = await supabase
    .from('quick_expenses')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as QuickExpense;
}

export async function deleteQuickExpense(id: string): Promise<void> {
  const { error } = await supabase
    .from('quick_expenses')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getQuickExpenseBudget(): Promise<QuickExpenseBudget | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('quick_expense_budgets')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data as QuickExpenseBudget | null;
}

export async function upsertQuickExpenseBudget(monthlyBudget: number): Promise<QuickExpenseBudget> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('quick_expense_budgets')
    .upsert({ user_id: user.id, monthly_budget: monthlyBudget, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return data as QuickExpenseBudget;
}

export async function getMonthlyBudget(year: number, month: number): Promise<QuickExpenseMonthlyBudget | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('quick_expense_monthly_budgets')
    .select('*')
    .eq('user_id', user.id)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  if (error) throw error;
  return data as QuickExpenseMonthlyBudget | null;
}

export async function upsertMonthlyBudget(year: number, month: number, budgetAmount: number): Promise<QuickExpenseMonthlyBudget> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('quick_expense_monthly_budgets')
    .upsert(
      { user_id: user.id, year, month, budget_amount: budgetAmount, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,year,month' }
    )
    .select()
    .single();

  if (error) throw error;
  return data as QuickExpenseMonthlyBudget;
}

export async function updateWeeklyCarryOver(year: number, month: number, carryOver: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('quick_expense_monthly_budgets')
    .update({
      weekly_carry_over: carryOver,
      last_carry_over_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('year', year)
    .eq('month', month);

  if (error) throw error;
}

export async function hasAcknowledgedTransition(year: number, month: number): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('quick_expense_month_transitions')
    .select('id')
    .eq('user_id', user.id)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

export async function acknowledgeMonthTransition(
  year: number,
  month: number,
  prevYear: number,
  prevMonth: number
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('quick_expense_month_transitions')
    .upsert(
      { user_id: user.id, year, month, prev_year: prevYear, prev_month: prevMonth },
      { onConflict: 'user_id,year,month' }
    );

  if (error) throw error;
}

export async function getPreviousMonthSummary(year: number, month: number): Promise<MonthSummary> {
  const prevDate = new Date(year, month - 2, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;

  const [expenses, monthlyBudget] = await Promise.all([
    getQuickExpensesForMonth(prevYear, prevMonth),
    getMonthlyBudget(prevYear, prevMonth),
  ]);

  const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const budgetAmount = monthlyBudget?.budget_amount ?? 0;

  return {
    year: prevYear,
    month: prevMonth,
    totalSpent,
    budgetAmount,
    expenseCount: expenses.length,
    wasOnBudget: budgetAmount > 0 && totalSpent <= budgetAmount,
  };
}

export async function getStreak(): Promise<QuickExpenseStreak | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('quick_expense_streaks')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data as QuickExpenseStreak | null;
}

export async function getWeeklyBudgetStreak(): Promise<QuickExpenseWeeklyStreak> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const weekStartDay = await getUserWeekStartDay();
  const today = new Date();
  const todayStr = toDateString(today);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const { data: monthlyBudgets, error: budgetError } = await supabase
    .from('quick_expense_monthly_budgets')
    .select('year, month, budget_amount')
    .eq('user_id', user.id)
    .order('year', { ascending: true })
    .order('month', { ascending: true });

  if (budgetError) throw budgetError;
  if (!monthlyBudgets || monthlyBudgets.length === 0) {
    return {
      current_streak: 0,
      longest_streak: 0,
      evaluated_weeks: 0,
      current_month_year: currentYear,
      current_month: currentMonth,
      last_completed_week_start: null,
      last_completed_week_end: null,
      streak_weeks: [],
      current_month_weeks: getWeeksInMonth(currentYear, currentMonth, weekStartDay).map(week => {
        const start = toDateString(week.start);
        const end = toDateString(week.end);
        return {
          iso_week_number: getISOWeekNumber(week.end),
          week_start: start,
          week_end: end,
          kept_budget: null,
          is_completed: end < todayStr,
          is_current: start <= todayStr && end >= todayStr,
        };
      }),
    };
  }

  const firstBudget = monthlyBudgets[0];
  const lastBudget = monthlyBudgets[monthlyBudgets.length - 1];
  const start = `${firstBudget.year}-${String(firstBudget.month).padStart(2, '0')}-01`;
  const lastDay = new Date(lastBudget.year, lastBudget.month, 0).getDate();
  const end = `${lastBudget.year}-${String(lastBudget.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: allExpenses, error: expensesError } = await supabase
    .from('quick_expenses')
    .select('*')
    .eq('user_id', user.id)
    .gte('expense_date', start)
    .lte('expense_date', end);

  if (expensesError) throw expensesError;
  const expenses = (allExpenses ?? []) as QuickExpense[];

  const completedWeeksRaw = monthlyBudgets
    .flatMap(({ year, month, budget_amount }) => {
      const budgetAmount = Number(budget_amount);
      if (budgetAmount <= 0) return [];
      const summary = computeWeeklyCarryOver(budgetAmount, Number(year), Number(month), expenses, new Date(), weekStartDay);
      return summary.weeks
        .filter(week => toDateString(week.weekEnd) < todayStr)
        .map(week => ({
          start: toDateString(week.weekStart),
          end: toDateString(week.weekEnd),
          isoWeekNumber: week.isoWeekNumber,
          keptBudget: !week.isOver,
        }));
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  const completedWeeks = completedWeeksRaw.filter((week, index, weeks) => (
    index === 0 || week.start !== weeks[index - 1].start || week.end !== weeks[index - 1].end
  ));

  let current = 0;
  let longest = 0;
  for (const week of completedWeeks) {
    if (week.keptBudget) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  const lastCompletedWeek = completedWeeks[completedWeeks.length - 1];
  const streakWeeks = current > 0
    ? completedWeeks.slice(-current).map(week => ({
        iso_week_number: week.isoWeekNumber,
        week_start: week.start,
        week_end: week.end,
      }))
    : [];
  const currentMonthBudget = monthlyBudgets.find(
    ({ year, month }) => Number(year) === currentYear && Number(month) === currentMonth
  );
  const currentMonthWeeks = currentMonthBudget && Number(currentMonthBudget.budget_amount) > 0
    ? computeWeeklyCarryOver(
        Number(currentMonthBudget.budget_amount),
        currentYear,
        currentMonth,
        expenses,
        today,
        weekStartDay
      ).weeks.map(week => {
        const start = toDateString(week.weekStart);
        const end = toDateString(week.weekEnd);
        const isCompleted = end < todayStr;
        return {
          iso_week_number: week.isoWeekNumber,
          week_start: start,
          week_end: end,
          kept_budget: isCompleted ? !week.isOver : null,
          is_completed: isCompleted,
          is_current: week.isCurrentWeek,
        };
      })
    : getWeeksInMonth(currentYear, currentMonth, weekStartDay).map(week => {
        const start = toDateString(week.start);
        const end = toDateString(week.end);
        return {
          iso_week_number: getISOWeekNumber(week.end),
          week_start: start,
          week_end: end,
          kept_budget: null,
          is_completed: end < todayStr,
          is_current: start <= todayStr && end >= todayStr,
        };
      });

  return {
    current_streak: current,
    longest_streak: longest,
    evaluated_weeks: completedWeeks.length,
    current_month_year: currentYear,
    current_month: currentMonth,
    last_completed_week_start: lastCompletedWeek?.start ?? null,
    last_completed_week_end: lastCompletedWeek?.end ?? null,
    streak_weeks: streakWeeks,
    current_month_weeks: currentMonthWeeks,
  };
}

export async function evaluateAndUpdateStreak(
  prevYear: number,
  prevMonth: number,
  wasOnBudget: boolean,
  usageRatioProp?: number
): Promise<QuickExpenseStreak> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const existing = await getStreak();

  const alreadyEvaluated =
    existing &&
    existing.last_evaluated_year === prevYear &&
    existing.last_evaluated_month === prevMonth;

  if (alreadyEvaluated) return existing!;

  const prevStreakCount = existing?.current_streak ?? 0;
  const currentStreak = wasOnBudget ? prevStreakCount + 1 : 0;
  const longestStreak = Math.max(existing?.longest_streak ?? 0, currentStreak);

  const prevScore = existing?.cumulative_score ?? 0;
  const delta = computeMonthlyScoreDelta(wasOnBudget, prevStreakCount, prevScore, usageRatioProp);
  const cumulativeScore = Math.max(0, prevScore + delta);

  const payload = {
    user_id: user.id,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    cumulative_score: cumulativeScore,
    last_evaluated_year: prevYear,
    last_evaluated_month: prevMonth,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('quick_expense_streaks')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;
  return data as QuickExpenseStreak;
}

export interface HistoricalMonthResult {
  year: number;
  month: number;
  budgetAmount: number;
  totalSpent: number;
  wasOnBudget: boolean;
  scoreDelta: number;
  cumulativeScoreAfter: number;
  streakAfter: number;
}

export async function backfillStreakFromHistory(): Promise<{
  monthsProcessed: number;
  history: HistoricalMonthResult[];
  finalStreak: QuickExpenseStreak;
} | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const existing = await getStreak();

  const { data: allMonthlyBudgets, error: mbError } = await supabase
    .from('quick_expense_monthly_budgets')
    .select('year, month, budget_amount')
    .eq('user_id', user.id)
    .order('year', { ascending: true })
    .order('month', { ascending: true });

  if (mbError) throw mbError;
  if (!allMonthlyBudgets || allMonthlyBudgets.length === 0) return null;

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  const firstEvaluatedKey = existing
    ? (existing.last_evaluated_year ?? 0) * 100 + (existing.last_evaluated_month ?? 0)
    : 0;

  const monthsToProcess = allMonthlyBudgets.filter(mb => {
    if (mb.year === curYear && mb.month === curMonth) return false;
    const mbKey = mb.year * 100 + mb.month;
    return mbKey > firstEvaluatedKey;
  });

  if (monthsToProcess.length === 0) return null;

  const { data: allExpenses, error: expError } = await supabase
    .from('quick_expenses')
    .select('amount, expense_date')
    .eq('user_id', user.id);

  if (expError) throw expError;
  const expenses = (allExpenses ?? []) as { amount: number; expense_date: string }[];

  let runningStreak = existing?.current_streak ?? 0;
  let runningLongest = existing?.longest_streak ?? 0;
  let runningScore = existing?.cumulative_score ?? 0;

  const history: HistoricalMonthResult[] = [];

  for (const mb of monthsToProcess) {
    const { year, month, budget_amount: budgetAmount } = mb;
    const padM = String(month).padStart(2, '0');
    const startStr = `${year}-${padM}-01`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const endStr = `${year}-${padM}-${String(daysInMonth).padStart(2, '0')}`;

    const totalSpent = expenses
      .filter(e => e.expense_date >= startStr && e.expense_date <= endStr)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const wasOnBudget = Number(budgetAmount) > 0 && totalSpent <= Number(budgetAmount);
    const usageRatio = Number(budgetAmount) > 0 ? Math.min(1, totalSpent / Number(budgetAmount)) : undefined;
    const delta = computeMonthlyScoreDelta(wasOnBudget, runningStreak, runningScore, usageRatio);

    runningStreak = wasOnBudget ? runningStreak + 1 : 0;
    runningLongest = Math.max(runningLongest, runningStreak);
    runningScore = Math.max(0, runningScore + delta);

    history.push({
      year,
      month,
      budgetAmount: Number(budgetAmount),
      totalSpent,
      wasOnBudget,
      scoreDelta: delta,
      cumulativeScoreAfter: runningScore,
      streakAfter: runningStreak,
    });
  }

  const lastMonth = monthsToProcess[monthsToProcess.length - 1];

  const payload = {
    user_id: user.id,
    current_streak: runningStreak,
    longest_streak: runningLongest,
    cumulative_score: runningScore,
    last_evaluated_year: lastMonth.year,
    last_evaluated_month: lastMonth.month,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('quick_expense_streaks')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw error;

  return {
    monthsProcessed: monthsToProcess.length,
    history,
    finalStreak: data as QuickExpenseStreak,
  };
}

export async function getUserWeekStartDay(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('user_precision_commitment')
    .select('week_start_day')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data?.week_start_day ?? 1;
}

export async function setUserWeekStartDay(weekStartDay: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: existing } = await supabase
    .from('user_precision_commitment')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('user_precision_commitment')
      .update({ week_start_day: weekStartDay })
      .eq('user_id', user.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('user_precision_commitment')
      .insert({
        user_id: user.id,
        week_start_day: weekStartDay,
        precision_mode: true,
        version: 'v1',
      });

    if (error) throw error;
  }
}
