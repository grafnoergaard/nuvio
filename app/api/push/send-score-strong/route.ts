import { NextRequest, NextResponse } from 'next/server';

import {
  getPushNotificationDefinition,
  resolvePushNotificationMessage,
  type PushNotificationConfigRow,
} from '@/lib/push-notifications';
import { createSupabaseServiceClient } from '@/lib/supabase-server';

function isAuthorized(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET || process.env.KUVERT_PUSH_SECRET;
  if (!expectedSecret) return false;

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const headerSecret = request.headers.get('x-kuvert-push-secret');

  return bearer === expectedSecret || headerSecret === expectedSecret;
}

function getMonthScore(
  monthlyBudget: number,
  monthlySpent: number,
  scoreThreshold: number,
  carryOverPenalty: number,
  now: Date
) {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(1, daysInMonth - now.getDate() + 1);
  const remaining = monthlyBudget - monthlySpent;
  const monthlyOverBudget = monthlyBudget > 0 && monthlySpent > monthlyBudget;

  if (monthlyBudget <= 0) return 0;
  if (monthlyOverBudget) return 0;
  if (remainingDays <= 0) return remaining >= 0 ? 100 : 0;

  const idealDailyRate = monthlyBudget / daysInMonth;
  const affordableDailyRate = remaining / remainingDays;
  const recoveryRatio = idealDailyRate > 0 ? affordableDailyRate / idealDailyRate : 0;
  const carryOverPenaltyRatio = monthlyBudget > 0 ? carryOverPenalty / monthlyBudget : 0;
  const penaltyFactor = Math.max(0, 1 - carryOverPenaltyRatio * 2);
  const baseScore = (() => {
    if (recoveryRatio >= 1 + scoreThreshold) return 100;
    if (recoveryRatio <= 0) return 0;
    return Math.max(0, Math.min(100, (recoveryRatio / (1 + scoreThreshold)) * 100));
  })();

  return Math.round(baseScore * penaltyFactor);
}

function getStrengthTier(score: number) {
  if (score >= 97) return 'near_perfect';
  if (score >= 92) return 'very_strong';
  if (score >= 85) return 'strong';
  return null;
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

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 });
  }

  const secret = process.env.KUVERT_PUSH_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'KUVERT_PUSH_SECRET mangler på serveren' }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const definition = getPushNotificationDefinition('score_strong');
  if (!definition) {
    return NextResponse.json({ error: 'Score-styrke-push definition mangler' }, { status: 500 });
  }

  const supabase = createSupabaseServiceClient();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const monthStart = `${monthKey}-01`;
  const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);

  const [
    { data: subscriptionRows, error: subscriptionError },
    { data: budgetRows, error: budgetError },
    { data: expenseRows, error: expenseError },
    { data: transitionRows, error: transitionError },
    { data: flowConfigEntries, error: flowConfigError },
    { data: configData },
    { data: deliveryStateRows, error: deliveryStateError },
  ] = await Promise.all([
    supabase
      .from('push_subscriptions')
      .select('user_id')
      .eq('is_active', true),
    supabase
      .from('quick_expense_monthly_budgets')
      .select('user_id,budget_amount')
      .eq('year', year)
      .eq('month', month)
      .gt('budget_amount', 0),
    supabase
      .from('quick_expenses')
      .select('user_id,amount')
      .gte('expense_date', monthStart)
      .lte('expense_date', monthEnd),
    supabase
      .from('quick_expense_week_transitions')
      .select('user_id,total_spent,budget_amount')
      .eq('year', year)
      .eq('month', month),
    supabase
      .from('standard_data_entries')
      .select('key,value_numeric')
      .eq('section', 'nuvio_flow'),
    supabase
      .from('push_notification_configs')
      .select('message_title,message_body,delivery_window_start_hour,delivery_window_end_hour,timezone')
      .eq('key', 'score_strong')
      .maybeSingle(),
    supabase
      .from('push_notification_user_state')
      .select('user_id,last_sent_week_key,last_sent_condition')
      .eq('notification_key', 'score_strong'),
  ]);

  if (subscriptionError || budgetError || expenseError || transitionError || flowConfigError || deliveryStateError) {
    return NextResponse.json({ error: 'Kunne ikke beregne score-styrke' }, { status: 500 });
  }

  const config = (configData ?? null) as (Pick<
    PushNotificationConfigRow,
    'message_title' | 'message_body' | 'delivery_window_start_hour' | 'delivery_window_end_hour' | 'timezone'
  > | null);

  const deliveryWindowStartHour = config?.delivery_window_start_hour ?? definition.defaultDeliveryWindowStartHour;
  const deliveryWindowEndHour = config?.delivery_window_end_hour ?? definition.defaultDeliveryWindowEndHour;
  const timeZone = config?.timezone ?? definition.defaultTimezone;

  if (!isWithinDeliveryWindow(now, deliveryWindowStartHour, deliveryWindowEndHour, timeZone)) {
    return NextResponse.json({ ok: true, targetedUsers: 0, sent: 0, failed: 0, deactivated: 0, skipped: 'outside_delivery_window' });
  }

  const scoreThreshold =
    (flowConfigEntries ?? []).find((entry) => entry.key === 'NUVIO_FLOW_SCORE_PERFECT_THRESHOLD')?.value_numeric ?? 0.15;
  const activeSubscriptionUsers = new Set((subscriptionRows ?? []).map((row) => row.user_id).filter(Boolean));
  const spentByUser = new Map<string, number>();
  for (const row of (expenseRows ?? []) as Array<{ user_id: string; amount: number }>) {
    spentByUser.set(row.user_id, (spentByUser.get(row.user_id) ?? 0) + Number(row.amount));
  }
  const carryOverPenaltyByUser = new Map<string, number>();
  for (const row of (transitionRows ?? []) as Array<{ user_id: string; total_spent: number; budget_amount: number }>) {
    const overspend = Math.max(0, Number(row.total_spent) - Number(row.budget_amount));
    carryOverPenaltyByUser.set(row.user_id, (carryOverPenaltyByUser.get(row.user_id) ?? 0) + overspend);
  }
  const deliveryStateByUser = new Map<string, { last_sent_week_key: string | null; last_sent_condition: string | null }>();
  for (const row of (deliveryStateRows ?? []) as Array<{ user_id: string; last_sent_week_key: string | null; last_sent_condition: string | null }>) {
    deliveryStateByUser.set(row.user_id, {
      last_sent_week_key: row.last_sent_week_key,
      last_sent_condition: row.last_sent_condition,
    });
  }

  const candidates = ((budgetRows ?? []) as Array<{ user_id: string; budget_amount: number }>)
    .filter((row) => row.user_id && activeSubscriptionUsers.has(row.user_id))
    .map((row) => {
      const monthlyBudget = Number(row.budget_amount);
      const monthlySpent = spentByUser.get(row.user_id) ?? 0;
      const carryOverPenalty = carryOverPenaltyByUser.get(row.user_id) ?? 0;
      const score = getMonthScore(monthlyBudget, monthlySpent, scoreThreshold, carryOverPenalty, now);
      const tier = getStrengthTier(score);
      return { userId: row.user_id, score, tier };
    })
    .filter((candidate): candidate is { userId: string; score: number; tier: 'strong' | 'very_strong' | 'near_perfect' } => candidate.tier !== null)
    .filter((candidate) => {
      const previous = deliveryStateByUser.get(candidate.userId);
      if (!previous) return true;
      if (previous.last_sent_week_key !== monthKey) return true;

      const rank = candidate.tier === 'near_perfect' ? 3 : candidate.tier === 'very_strong' ? 2 : 1;
      const previousRank =
        previous.last_sent_condition === 'near_perfect'
          ? 3
          : previous.last_sent_condition === 'very_strong'
            ? 2
            : previous.last_sent_condition === 'strong'
              ? 1
              : 0;

      return rank > previousRank;
    });

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
    return NextResponse.json({ error: result?.error || 'Kunne ikke sende positiv score-push' }, { status: response.status });
  }

  await supabase
    .from('push_notification_user_state')
    .upsert(
      candidates.map((candidate) => ({
        notification_key: 'score_strong',
        user_id: candidate.userId,
        last_sent_at: now.toISOString(),
        last_sent_week_key: monthKey,
        last_sent_condition: candidate.tier,
      })) as any,
      { onConflict: 'notification_key,user_id' }
    );

  return NextResponse.json({
    ok: true,
    targetedUsers: targetedUserIds.length,
    ...result,
  });
}
