import { NextRequest, NextResponse } from 'next/server';

import {
  type QuickExpense,
  type QuickExpenseMonthlyBudget,
} from '@/lib/quick-expense-service';
import {
  computeWeekSummaryData,
  getPreviousWeekInfo,
} from '@/lib/week-transition-service';
import {
  getPushNotificationDefinition,
  resolvePushNotificationMessage,
  type PushNotificationConfigRow,
} from '@/lib/push-notifications';
import { createSupabaseServiceClient } from '@/lib/supabase-server';
import { getInternalAppUrl, getPushInternalHeaders } from '@/lib/push-route-utils';

type PendingWeekCandidate = {
  userId: string;
  weekKey: string;
};

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

function getLocalToday(now: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';

  return new Date(
    Number(part('year')),
    Number(part('month')) - 1,
    Number(part('day')),
    12,
    0,
    0
  );
}

async function getOrCreateWeekTransitionCandidate({
  supabase,
  userId,
  year,
  month,
  weekNumber,
  weekStart,
  weekEnd,
  weekStartDay,
}: {
  supabase: ReturnType<typeof createSupabaseServiceClient>;
  userId: string;
  year: number;
  month: number;
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  weekStartDay: number;
}) {
  const { data: existingTransition, error: transitionError } = await supabase
    .from('quick_expense_week_transitions')
    .select('acknowledged_at,budget_amount,total_spent,carry_over,transaction_count')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month)
    .eq('week_number', weekNumber)
    .maybeSingle();

  if (transitionError) throw transitionError;
  if (existingTransition?.acknowledged_at) return null;
  if (existingTransition && Number(existingTransition.budget_amount) > 0) return true;

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = toDateString(new Date(year, month, 0));

  const [
    { data: budgetData, error: budgetError },
    { data: expenseRows, error: expenseError },
  ] = await Promise.all([
    supabase
      .from('quick_expense_monthly_budgets')
      .select('id,user_id,year,month,budget_amount,weekly_carry_over,last_carry_over_updated_at,created_at,updated_at')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle(),
    supabase
      .from('quick_expenses')
      .select('id,user_id,amount,note,expense_date,created_at,spread_over_month')
      .eq('user_id', userId)
      .gte('expense_date', monthStart)
      .lte('expense_date', monthEnd),
  ]);

  if (budgetError || expenseError) throw budgetError ?? expenseError;

  const monthlyBudget = (budgetData ?? null) as QuickExpenseMonthlyBudget | null;
  if (!monthlyBudget || Number(monthlyBudget.budget_amount) <= 0) return null;

  const expenses = (expenseRows ?? []) as QuickExpense[];
  const summary = await computeWeekSummaryData(
    year,
    month,
    weekNumber,
    weekStart,
    weekEnd,
    expenses,
    monthlyBudget,
    weekStartDay
  );

  if (summary.budgetAmount <= 0) return null;

  const { error: upsertError } = await supabase
    .from('quick_expense_week_transitions')
    .upsert(
      {
        user_id: userId,
        year,
        month,
        week_number: weekNumber,
        budget_amount: summary.budgetAmount,
        total_spent: summary.totalSpent,
        carry_over: summary.carryOver,
        transaction_count: summary.transactionCount,
      },
      { onConflict: 'user_id,year,month,week_number' }
    );

  if (upsertError) throw upsertError;
  return true;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 });
  }

  const secret = process.env.KUVERT_PUSH_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'KUVERT_PUSH_SECRET mangler på serveren' }, { status: 500 });
  }

  const appUrl = getInternalAppUrl(request);
  const definition = getPushNotificationDefinition('week_transition');
  if (!definition) {
    return NextResponse.json({ error: 'WeekTransition-push definition mangler' }, { status: 500 });
  }

  const supabase = createSupabaseServiceClient();
  const now = new Date();

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
      .select('message_title,message_body,timezone')
      .eq('key', 'week_transition')
      .maybeSingle(),
  ]);

  if (subscriptionError) {
    return NextResponse.json({ error: 'Kunne ikke hente push-modtagere' }, { status: 500 });
  }

  const config = (configData ?? null) as (Pick<
    PushNotificationConfigRow,
    'message_title' | 'message_body' | 'timezone'
  > | null);
  const timeZone = config?.timezone ?? definition.defaultTimezone;
  const today = getLocalToday(now, timeZone);
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const subscribedUserIds = Array.from(
    new Set((subscriptionRows ?? []).map((row) => row.user_id).filter(Boolean))
  );

  if (subscribedUserIds.length === 0) {
    return NextResponse.json({ ok: true, targetedUsers: 0, sent: 0, failed: 0, deactivated: 0 });
  }

  const [
    { data: precisionRows, error: precisionError },
    { data: deliveryStateRows, error: deliveryStateError },
  ] = await Promise.all([
    supabase
      .from('user_precision_commitment')
      .select('user_id,week_start_day')
      .in('user_id', subscribedUserIds),
    supabase
      .from('push_notification_user_state')
      .select('user_id,last_sent_week_key')
      .eq('notification_key', 'week_transition')
      .in('user_id', subscribedUserIds),
  ]);

  if (precisionError || deliveryStateError) {
    return NextResponse.json({ error: 'Kunne ikke hente ugeindstillinger' }, { status: 500 });
  }

  const weekStartDayByUser = new Map<string, number>();
  for (const row of (precisionRows ?? []) as Array<{ user_id: string; week_start_day: number | null }>) {
    weekStartDayByUser.set(row.user_id, row.week_start_day ?? 1);
  }

  const sentWeekKeyByUser = new Map<string, string | null>();
  for (const row of (deliveryStateRows ?? []) as Array<{ user_id: string; last_sent_week_key: string | null }>) {
    sentWeekKeyByUser.set(row.user_id, row.last_sent_week_key);
  }

  const candidates: PendingWeekCandidate[] = [];

  for (const userId of subscribedUserIds) {
    const weekStartDay = weekStartDayByUser.get(userId) ?? 1;
    const previousWeek = getPreviousWeekInfo(year, month, today, weekStartDay);
    if (!previousWeek) continue;

    const weekKey = `${previousWeek.year}-${String(previousWeek.month).padStart(2, '0')}-w${previousWeek.weekNumber}`;
    if (sentWeekKeyByUser.get(userId) === weekKey) continue;

    const isCandidate = await getOrCreateWeekTransitionCandidate({
      supabase,
      userId,
      year: previousWeek.year,
      month: previousWeek.month,
      weekNumber: previousWeek.weekNumber,
      weekStart: previousWeek.weekStart,
      weekEnd: previousWeek.weekEnd,
      weekStartDay,
    });

    if (!isCandidate) continue;
    candidates.push({ userId, weekKey });
  }

  const targetedUserIds = candidates.map((candidate) => candidate.userId);
  if (targetedUserIds.length === 0) {
    return NextResponse.json({
      ok: true,
      targetedUsers: 0,
      sent: 0,
      failed: 0,
      deactivated: 0,
      skipped: 'no_pending_week_transitions',
    });
  }

  const payload = resolvePushNotificationMessage(definition, config);

  const response = await fetch(new URL('/api/push/send', appUrl), {
    method: 'POST',
    headers: getPushInternalHeaders(secret),
    body: JSON.stringify({
      ...payload,
      userIds: targetedUserIds,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    return NextResponse.json({
      error: result?.error || 'Kunne ikke sende WeekTransition-push',
    }, { status: response.status });
  }

  await supabase
    .from('push_notification_user_state')
    .upsert(
      candidates.map((candidate) => ({
        notification_key: 'week_transition',
        user_id: candidate.userId,
        last_sent_at: now.toISOString(),
        last_sent_week_key: candidate.weekKey,
        last_sent_condition: null,
      })) as any,
      { onConflict: 'notification_key,user_id' }
    );

  return NextResponse.json({
    ok: true,
    targetedUsers: targetedUserIds.length,
    ...result,
  });
}
