import { NextRequest, NextResponse } from 'next/server';

import { computeWeeklyCarryOver, type QuickExpense } from '@/lib/quick-expense-service';
import {
  getPushNotificationDefinition,
  resolvePushNotificationMessage,
  type PushNotificationConfigRow,
  type StreakRiskTriggerCondition,
} from '@/lib/push-notifications';
import { createSupabaseServiceClient } from '@/lib/supabase-server';
import { getDaysLeftInRange, getWeeklyBudgetSituation } from '@/lib/weekly-budget-helpers';

function isAuthorized(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET || process.env.KUVERT_PUSH_SECRET;
  if (!expectedSecret) return false;

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const headerSecret = request.headers.get('x-kuvert-push-secret');

  return bearer === expectedSecret || headerSecret === expectedSecret;
}

function toDateString(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getSituationSeverity(situation: 'ahead' | 'close' | 'over') {
  if (situation === 'over') return 2;
  if (situation === 'close') return 1;
  return 0;
}

function matchesTriggerCondition(
  situation: 'ahead' | 'close' | 'over',
  triggerCondition: StreakRiskTriggerCondition
) {
  if (triggerCondition === 'both') return situation === 'close' || situation === 'over';
  return situation === triggerCondition;
}

function isWithinDeliveryWindow(now: Date, startHour: number, endHour: number, timeZone: string) {
  const localHour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now));

  if (Number.isNaN(localHour) || startHour === endHour) return true;
  if (startHour < endHour) return localHour >= startHour && localHour < endHour;
  return localHour >= startHour || localHour < endHour;
}

type WeeklyBudgetLowCandidate = {
  userId: string;
  weekKey: string;
  situation: 'ahead' | 'close' | 'over';
};

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 });
  }

  const secret = process.env.KUVERT_PUSH_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'KUVERT_PUSH_SECRET mangler på serveren' }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const definition = getPushNotificationDefinition('weekly_budget_low');
  if (!definition) {
    return NextResponse.json({ error: 'Ugebudget-push definition mangler' }, { status: 500 });
  }

  const supabase = createSupabaseServiceClient();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = toDateString(new Date(year, month, 0));

  const [
    { data: subscriptionRows, error: subscriptionError },
    { data: configData },
  ] = await Promise.all([
    supabase
      .from('push_subscriptions')
      .select('user_id')
      .eq('is_active', true),
    supabase
      .from('push_notification_configs')
      .select('message_title,message_body,trigger_condition,delivery_window_start_hour,delivery_window_end_hour,timezone')
      .eq('key', 'weekly_budget_low')
      .maybeSingle(),
  ]);

  if (subscriptionError) {
    return NextResponse.json({ error: 'Kunne ikke hente push-modtagere' }, { status: 500 });
  }

  const config = (configData ?? null) as (Pick<
    PushNotificationConfigRow,
    'message_title' | 'message_body' | 'trigger_condition' | 'delivery_window_start_hour' | 'delivery_window_end_hour' | 'timezone'
  > | null);
  const triggerCondition = config?.trigger_condition ?? definition.defaultTriggerCondition;
  const deliveryWindowStartHour = config?.delivery_window_start_hour ?? definition.defaultDeliveryWindowStartHour;
  const deliveryWindowEndHour = config?.delivery_window_end_hour ?? definition.defaultDeliveryWindowEndHour;
  const timeZone = config?.timezone ?? definition.defaultTimezone;

  if (!isWithinDeliveryWindow(now, deliveryWindowStartHour, deliveryWindowEndHour, timeZone)) {
    return NextResponse.json({
      ok: true,
      targetedUsers: 0,
      sent: 0,
      failed: 0,
      deactivated: 0,
      skipped: 'outside_delivery_window',
    });
  }

  const subscribedUserIds = Array.from(new Set((subscriptionRows ?? []).map((row) => row.user_id).filter(Boolean)));
  if (subscribedUserIds.length === 0) {
    return NextResponse.json({ ok: true, targetedUsers: 0, sent: 0, failed: 0, deactivated: 0 });
  }

  const [
    { data: budgetRows, error: budgetError },
    { data: expenseRows, error: expenseError },
    { data: precisionRows, error: precisionError },
    { data: deliveryStateRows, error: deliveryStateError },
  ] = await Promise.all([
    supabase
      .from('quick_expense_monthly_budgets')
      .select('user_id,budget_amount')
      .eq('year', year)
      .eq('month', month)
      .in('user_id', subscribedUserIds)
      .gt('budget_amount', 0),
    supabase
      .from('quick_expenses')
      .select('user_id,amount,expense_date')
      .in('user_id', subscribedUserIds)
      .gte('expense_date', monthStart)
      .lte('expense_date', monthEnd),
    supabase
      .from('user_precision_commitment')
      .select('user_id,week_start_day')
      .in('user_id', subscribedUserIds),
    supabase
      .from('push_notification_user_state')
      .select('user_id,last_sent_week_key,last_sent_condition')
      .eq('notification_key', 'weekly_budget_low')
      .in('user_id', subscribedUserIds),
  ]);

  if (budgetError || expenseError || precisionError || deliveryStateError) {
    return NextResponse.json({ error: 'Kunne ikke beregne lavt ugebudget' }, { status: 500 });
  }

  const expensesByUser = new Map<string, QuickExpense[]>();
  for (const row of (expenseRows ?? []) as Array<{ user_id: string; amount: number; expense_date: string }>) {
    const existing = expensesByUser.get(row.user_id) ?? [];
    existing.push({
      id: '',
      user_id: row.user_id,
      amount: Number(row.amount),
      note: null,
      expense_date: row.expense_date,
      created_at: row.expense_date,
    });
    expensesByUser.set(row.user_id, existing);
  }

  const weekStartDayByUser = new Map<string, number>();
  for (const row of (precisionRows ?? []) as Array<{ user_id: string; week_start_day: number | null }>) {
    weekStartDayByUser.set(row.user_id, row.week_start_day ?? 1);
  }

  const deliveryStateByUser = new Map<string, { last_sent_week_key: string | null; last_sent_condition: string | null }>();
  for (const row of (deliveryStateRows ?? []) as Array<{ user_id: string; last_sent_week_key: string | null; last_sent_condition: string | null }>) {
    deliveryStateByUser.set(row.user_id, {
      last_sent_week_key: row.last_sent_week_key,
      last_sent_condition: row.last_sent_condition,
    });
  }

  const candidates: WeeklyBudgetLowCandidate[] = [];

  for (const row of (budgetRows ?? []) as Array<{ user_id: string; budget_amount: number }>) {
    const userId = row.user_id;
    const expenses = expensesByUser.get(userId) ?? [];
    const weekStartDay = weekStartDayByUser.get(userId) ?? 1;
    const currentWeek = computeWeeklyCarryOver(Number(row.budget_amount), year, month, expenses, now, weekStartDay)
      .weeks.find((week) => week.isCurrentWeek);

    if (!currentWeek) continue;

    const situation = getWeeklyBudgetSituation(currentWeek, getDaysLeftInRange(currentWeek.weekEnd, now));
    if (!matchesTriggerCondition(situation, triggerCondition)) continue;

    const weekKey = currentWeek.weekStart.toISOString().slice(0, 10);
    const deliveryState = deliveryStateByUser.get(userId);

    if (deliveryState?.last_sent_week_key === weekKey) {
      const previousSeverity = getSituationSeverity((deliveryState.last_sent_condition as 'ahead' | 'close' | 'over' | null) ?? 'ahead');
      const currentSeverity = getSituationSeverity(situation);
      if (previousSeverity >= currentSeverity) continue;
    }

    candidates.push({
      userId,
      weekKey,
      situation,
    });
  }

  const targetedUserIds = candidates.map((candidate) => candidate.userId);

  if (targetedUserIds.length === 0) {
    return NextResponse.json({
      ok: true,
      targetedUsers: 0,
      sent: 0,
      failed: 0,
      deactivated: 0,
      skipped: 'no_users_matched_trigger',
    });
  }

  const payload = resolvePushNotificationMessage(
    definition,
    config as Pick<PushNotificationConfigRow, 'message_title' | 'message_body'> | null
  );

  const response = await fetch(new URL('/api/push/send', appUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-kuvert-push-secret': secret,
    },
    body: JSON.stringify({
      ...payload,
      userIds: targetedUserIds,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    return NextResponse.json({
      error: result?.error || 'Kunne ikke sende ugebudget-push',
    }, { status: response.status });
  }

  await supabase
    .from('push_notification_user_state')
    .upsert(
      candidates.map((candidate) => ({
        notification_key: 'weekly_budget_low',
        user_id: candidate.userId,
        last_sent_at: now.toISOString(),
        last_sent_week_key: candidate.weekKey,
        last_sent_condition: candidate.situation,
      })) as any,
      { onConflict: 'notification_key,user_id' }
    );

  return NextResponse.json({
    ok: true,
    targetedUsers: targetedUserIds.length,
    ...result,
  });
}
