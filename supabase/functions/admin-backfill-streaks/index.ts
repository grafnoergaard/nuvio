import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FLOW_SCORE_BASE_MONTHLY_REWARD = 100;
const FLOW_SCORE_STREAK_BONUS_PER_MONTH = 0.15;
const FLOW_SCORE_PENALTY_MIN = 50;
const FLOW_SCORE_PENALTY_PCT = 0.25;

function computeQualityBonus(usageRatio: number): number {
  if (usageRatio < 0 || usageRatio > 1) return 0;
  if (usageRatio < 0.5) return 30;
  if (usageRatio < 0.75) return 50;
  if (usageRatio < 0.90) return 25;
  return 10;
}

function computeMonthlyScoreDelta(
  wasOnBudget: boolean,
  currentStreak: number,
  prevCumulativeScore: number,
  usageRatio?: number
): number {
  if (!wasOnBudget) {
    const pctPenalty = Math.round(prevCumulativeScore * FLOW_SCORE_PENALTY_PCT);
    return -Math.max(FLOW_SCORE_PENALTY_MIN, pctPenalty);
  }
  const streakMultiplier = 1 + currentStreak * FLOW_SCORE_STREAK_BONUS_PER_MONTH;
  const qualityBonus = usageRatio !== undefined ? computeQualityBonus(usageRatio) : 0;
  const baseReward = FLOW_SCORE_BASE_MONTHLY_REWARD + qualityBonus;
  const reward = Math.round(baseReward * streakMultiplier);
  return Math.max(0, reward);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAdmin = user.app_metadata?.is_admin === true;
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    const { data: allUsers, error: usersError } = await adminClient.auth.admin.listUsers();
    if (usersError) throw usersError;

    const results: { userId: string; monthsProcessed: number; finalScore: number; finalStreak: number }[] = [];
    const errors: { userId: string; stage: string; error: string }[] = [];

    for (const u of allUsers.users) {
      const userId = u.id;

      const { data: allMonthlyBudgets, error: mbError } = await adminClient
        .from("quick_expense_monthly_budgets")
        .select("year, month, budget_amount")
        .eq("user_id", userId)
        .order("year", { ascending: true })
        .order("month", { ascending: true });

      if (mbError || !allMonthlyBudgets || allMonthlyBudgets.length === 0) {
        if (mbError) errors.push({ userId, stage: "monthly_budgets", error: String(mbError.message) });
        continue;
      }

      const monthsToProcess = allMonthlyBudgets.filter((mb: { year: number; month: number }) => {
        return !(mb.year === curYear && mb.month === curMonth);
      });

      if (monthsToProcess.length === 0) continue;

      const firstMonth = monthsToProcess[0];
      const lastMonthEntry = monthsToProcess[monthsToProcess.length - 1];
      const windowStart = `${firstMonth.year}-${String(firstMonth.month).padStart(2, "0")}-01`;
      const lastDaysInMonth = new Date(lastMonthEntry.year, lastMonthEntry.month, 0).getDate();
      const windowEnd = `${lastMonthEntry.year}-${String(lastMonthEntry.month).padStart(2, "0")}-${String(lastDaysInMonth).padStart(2, "0")}`;

      const { data: allExpenses, error: expError } = await adminClient
        .from("quick_expenses")
        .select("amount, expense_date")
        .eq("user_id", userId)
        .gte("expense_date", windowStart)
        .lte("expense_date", windowEnd);

      if (expError) {
        errors.push({ userId, stage: "expenses", error: String(expError.message) });
        continue;
      }
      const expenses = (allExpenses ?? []) as { amount: number; expense_date: string }[];

      const expensesByMonth = new Map<string, number>();
      for (const e of expenses) {
        const key = e.expense_date.substring(0, 7);
        expensesByMonth.set(key, (expensesByMonth.get(key) ?? 0) + Number(e.amount));
      }

      let runningStreak = 0;
      let runningLongest = 0;
      let runningScore = 0;

      for (const mb of monthsToProcess) {
        const { year, month, budget_amount: budgetAmount } = mb;
        const padM = String(month).padStart(2, "0");
        const startStr = `${year}-${padM}-01`;
        const daysInMonth = new Date(year, month, 0).getDate();
        const endStr = `${year}-${padM}-${String(daysInMonth).padStart(2, "0")}`;

        const monthKey = `${year}-${padM}`;
        const totalSpent = expensesByMonth.get(monthKey) ?? 0;

        const wasOnBudget = Number(budgetAmount) > 0 && totalSpent <= Number(budgetAmount);
        const usageRatio = Number(budgetAmount) > 0 ? Math.min(1, totalSpent / Number(budgetAmount)) : undefined;
        const delta = computeMonthlyScoreDelta(wasOnBudget, runningStreak, runningScore, usageRatio);

        runningStreak = wasOnBudget ? runningStreak + 1 : 0;
        runningLongest = Math.max(runningLongest, runningStreak);
        runningScore = Math.max(0, runningScore + delta);
      }

      const lastMonth = monthsToProcess[monthsToProcess.length - 1];

      const payload = {
        user_id: userId,
        current_streak: runningStreak,
        longest_streak: runningLongest,
        cumulative_score: runningScore,
        last_evaluated_year: lastMonth.year,
        last_evaluated_month: lastMonth.month,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await adminClient
        .from("quick_expense_streaks")
        .upsert(payload, { onConflict: "user_id" });

      if (upsertError) {
        errors.push({ userId, stage: "upsert", error: String(upsertError.message) });
        continue;
      }

      results.push({
        userId,
        monthsProcessed: monthsToProcess.length,
        finalScore: runningScore,
        finalStreak: runningStreak,
      });
    }

    return new Response(JSON.stringify({ success: true, usersProcessed: results.length, results, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
