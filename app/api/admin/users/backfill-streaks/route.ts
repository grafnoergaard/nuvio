import { NextRequest, NextResponse } from 'next/server';

import { requireAdminUser } from '@/lib/admin-api-auth';
import { computeMonthlyScoreDelta } from '@/lib/quick-expense-service';
import { createSupabaseServiceClient } from '@/lib/supabase-server';

type MonthlyBudgetRow = {
  year: number;
  month: number;
  budget_amount: number;
};

type ExpenseRow = {
  amount: number;
  expense_date: string;
};

export async function POST(request: NextRequest) {
  const admin = await requireAdminUser(request.headers.get('authorization'));
  if (admin.error) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const supabase = createSupabaseServiceClient();
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  try {
    const { data: allUsers, error: usersError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) throw usersError;

    const results: { userId: string; monthsProcessed: number; finalScore: number; finalStreak: number }[] = [];
    const errors: { userId: string; stage: string; error: string }[] = [];

    for (const user of allUsers.users) {
      const userId = user.id;

      const { data: allMonthlyBudgets, error: monthlyBudgetError } = await supabase
        .from('quick_expense_monthly_budgets')
        .select('year, month, budget_amount')
        .eq('user_id', userId)
        .order('year', { ascending: true })
        .order('month', { ascending: true });

      if (monthlyBudgetError || !allMonthlyBudgets || allMonthlyBudgets.length === 0) {
        if (monthlyBudgetError) {
          errors.push({ userId, stage: 'monthly_budgets', error: monthlyBudgetError.message });
        }
        continue;
      }

      const monthsToProcess = (allMonthlyBudgets as MonthlyBudgetRow[]).filter((monthBudget) => (
        !(monthBudget.year === curYear && monthBudget.month === curMonth)
      ));

      if (monthsToProcess.length === 0) continue;

      const firstMonth = monthsToProcess[0];
      const lastMonth = monthsToProcess[monthsToProcess.length - 1];
      const windowStart = `${firstMonth.year}-${String(firstMonth.month).padStart(2, '0')}-01`;
      const lastDaysInMonth = new Date(lastMonth.year, lastMonth.month, 0).getDate();
      const windowEnd = `${lastMonth.year}-${String(lastMonth.month).padStart(2, '0')}-${String(lastDaysInMonth).padStart(2, '0')}`;

      const { data: allExpenses, error: expensesError } = await supabase
        .from('quick_expenses')
        .select('amount, expense_date')
        .eq('user_id', userId)
        .eq('mode', 'normal')
        .gte('expense_date', windowStart)
        .lte('expense_date', windowEnd);

      if (expensesError) {
        errors.push({ userId, stage: 'expenses', error: expensesError.message });
        continue;
      }

      const expensesByMonth = new Map<string, number>();
      for (const expense of (allExpenses ?? []) as ExpenseRow[]) {
        const monthKey = expense.expense_date.substring(0, 7);
        expensesByMonth.set(monthKey, (expensesByMonth.get(monthKey) ?? 0) + Number(expense.amount));
      }

      let runningStreak = 0;
      let runningLongest = 0;
      let runningScore = 0;

      for (const monthBudget of monthsToProcess) {
        const { year, month, budget_amount: budgetAmount } = monthBudget;
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const totalSpent = expensesByMonth.get(monthKey) ?? 0;
        const budget = Number(budgetAmount);
        const wasOnBudget = budget > 0 && totalSpent <= budget;
        const usageRatio = budget > 0 ? Math.min(1, totalSpent / budget) : undefined;
        const delta = computeMonthlyScoreDelta(wasOnBudget, runningStreak, runningScore, usageRatio);

        runningStreak = wasOnBudget ? runningStreak + 1 : 0;
        runningLongest = Math.max(runningLongest, runningStreak);
        runningScore = Math.max(0, runningScore + delta);
      }

      const payload = {
        user_id: userId,
        current_streak: runningStreak,
        longest_streak: runningLongest,
        cumulative_score: runningScore,
        last_evaluated_year: lastMonth.year,
        last_evaluated_month: lastMonth.month,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from('quick_expense_streaks')
        .upsert(payload, { onConflict: 'user_id' });

      if (upsertError) {
        errors.push({ userId, stage: 'upsert', error: upsertError.message });
        continue;
      }

      results.push({
        userId,
        monthsProcessed: monthsToProcess.length,
        finalScore: runningScore,
        finalStreak: runningStreak,
      });
    }

    return NextResponse.json({
      success: true,
      usersProcessed: results.length,
      results,
      errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backfill fejlede';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
