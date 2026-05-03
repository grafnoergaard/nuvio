import { NextRequest, NextResponse } from 'next/server';

import {
  getPushNotificationDefinition,
  resolvePushNotificationMessage,
  type PushNotificationConfigRow,
} from '@/lib/push-notifications';
import { createSupabaseServiceClient } from '@/lib/supabase-server';

type WeekBudgetCandidate = {
  userId: string;
  weekKey: string;
};

type MonthlyBudgetRow = {
  user_id: string;
  budget_amount: number | null;
  created_at: string | null;
  updated_at: string | null;
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

function getCurrentWeekStart(today: Date, weekStartDay: number) {
  const daysSinceWeekStart = (today.getDay() - weekStartDay + 7) % 7;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysSinceWeekStart);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function getTouchedDate(row: MonthlyBudgetRow | null) {
  const updatedAt = row?.updated_at ? new Date(row.updated_at).getTime() : 0;
  const createdAt = row?.created_at ? new Date(row.created_at).getTime() : 0;
  const touchedAt = Math.max(updatedAt, createdAt);
  return Number.isFinite(touchedAt) && touchedAt > 0 ? new Date(touchedAt) : null;
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
  const definition = getPushNotificationDefinition('week_budget_setup');
  if (!definition) {
    return NextResponse.json({ error: 'Rådighedsbeløb-push definition mangler' }, { status: 500 });
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
      .eq('key', 'week_budget_setup')
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
  const todayKey = toDateString(today);

  const subscribedUserIds = Array.from(
    new Set((subscriptionRows ?? []).map((row) => row.user_id).filter(Boolean))
  );

  if (subscribedUserIds.length === 0) {
    return NextResponse.json({ ok: true, targetedUsers: 0, sent: 0, failed: 0, deactivated: 0 });
  }

  const [
    { data: precisionRows, error: precisionError },
    { data: monthlyBudgetRows, error: monthlyBudgetError },
    { data: deliveryStateRows, error: deliveryStateError },
  ] = await Promise.all([
    supabase
      .from('user_precision_commitment')
      .select('user_id,week_start_day')
      .in('user_id', subscribedUserIds),
    supabase
      .from('quick_expense_monthly_budgets')
      .select('user_id,budget_amount,created_at,updated_at')
      .eq('year', year)
      .eq('month', month)
      .in('user_id', subscribedUserIds),
    supabase
      .from('push_notification_user_state')
      .select('user_id,last_sent_at,last_sent_week_key')
      .eq('notification_key', 'week_budget_setup')
      .in('user_id', subscribedUserIds),
  ]);

  if (precisionError || monthlyBudgetError || deliveryStateError) {
    return NextResponse.json({ error: 'Kunne ikke hente ugeskift-status' }, { status: 500 });
  }

  const weekStartDayByUser = new Map<string, number>();
  for (const row of (precisionRows ?? []) as Array<{ user_id: string; week_start_day: number | null }>) {
    weekStartDayByUser.set(row.user_id, row.week_start_day ?? 1);
  }

  const monthlyBudgetByUser = new Map<string, MonthlyBudgetRow>();
  for (const row of (monthlyBudgetRows ?? []) as MonthlyBudgetRow[]) {
    monthlyBudgetByUser.set(row.user_id, row);
  }

  const lastSentDateByUser = new Map<string, string | null>();
  for (const row of (deliveryStateRows ?? []) as Array<{ user_id: string; last_sent_at: string | null }>) {
    const lastSent = row.last_sent_at ? getLocalToday(new Date(row.last_sent_at), timeZone) : null;
    lastSentDateByUser.set(row.user_id, lastSent ? toDateString(lastSent) : null);
  }

  const candidates: WeekBudgetCandidate[] = [];

  for (const userId of subscribedUserIds) {
    if (lastSentDateByUser.get(userId) === todayKey) continue;

    const weekStartDay = weekStartDayByUser.get(userId) ?? 1;
    const weekStart = getCurrentWeekStart(today, weekStartDay);
    const weekKey = toDateString(weekStart);
    const monthlyBudget = monthlyBudgetByUser.get(userId) ?? null;
    const touchedDate = getTouchedDate(monthlyBudget);
    const touchedKey = touchedDate ? toDateString(getLocalToday(touchedDate, timeZone)) : null;

    const hasConfirmedThisWeek =
      Number(monthlyBudget?.budget_amount ?? 0) > 0 &&
      Boolean(touchedKey && touchedKey >= weekKey);

    if (hasConfirmedThisWeek) continue;
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
      skipped: 'all_users_have_confirmed_week_budget',
    });
  }

  const payload = resolvePushNotificationMessage(definition, config);

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
      error: result?.error || 'Kunne ikke sende rådighedsbeløb-push',
    }, { status: response.status });
  }

  await supabase
    .from('push_notification_user_state')
    .upsert(
      candidates.map((candidate) => ({
        notification_key: 'week_budget_setup',
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
