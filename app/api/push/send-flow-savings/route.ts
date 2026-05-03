import { NextRequest, NextResponse } from 'next/server';

import {
  getPushNotificationDefinition,
  resolvePushNotificationMessage,
  type PushNotificationConfigRow,
} from '@/lib/push-notifications';
import { createSupabaseServiceClient } from '@/lib/supabase-server';
import { getPreviousWeekInfo } from '@/lib/week-transition-service';

type FlowSavingsCandidate = {
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

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 });
  }

  const secret = process.env.KUVERT_PUSH_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'KUVERT_PUSH_SECRET mangler på serveren' }, { status: 500 });
  }

  const appUrl = request.nextUrl.origin;
  const definition = getPushNotificationDefinition('flow_savings');
  if (!definition) {
    return NextResponse.json({ error: 'FlowSavings-push definition mangler' }, { status: 500 });
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
      .eq('key', 'flow_savings')
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
      .eq('notification_key', 'flow_savings')
      .in('user_id', subscribedUserIds),
  ]);

  if (precisionError || deliveryStateError) {
    return NextResponse.json({ error: 'Kunne ikke hente Sparet-triggerdata' }, { status: 500 });
  }

  const weekStartDayByUser = new Map<string, number>();
  for (const row of (precisionRows ?? []) as Array<{ user_id: string; week_start_day: number | null }>) {
    weekStartDayByUser.set(row.user_id, row.week_start_day ?? 1);
  }

  const sentWeekKeyByUser = new Map<string, string | null>();
  for (const row of (deliveryStateRows ?? []) as Array<{ user_id: string; last_sent_week_key: string | null }>) {
    sentWeekKeyByUser.set(row.user_id, row.last_sent_week_key);
  }

  const weekInfoByUser = new Map<string, { year: number; month: number; weekNumber: number; weekKey: string }>();
  const weekKeys = new Set<string>();

  for (const userId of subscribedUserIds) {
    const weekStartDay = weekStartDayByUser.get(userId) ?? 1;
    const previousWeek = getPreviousWeekInfo(year, month, today, weekStartDay);
    if (!previousWeek) continue;

    const weekKey = `${previousWeek.year}-${String(previousWeek.month).padStart(2, '0')}-w${previousWeek.weekNumber}`;
    if (sentWeekKeyByUser.get(userId) === weekKey) continue;

    weekInfoByUser.set(userId, {
      year: previousWeek.year,
      month: previousWeek.month,
      weekNumber: previousWeek.weekNumber,
      weekKey,
    });
    weekKeys.add(`${previousWeek.year}-${previousWeek.month}-${previousWeek.weekNumber}`);
  }

  if (weekInfoByUser.size === 0) {
    return NextResponse.json({
      ok: true,
      targetedUsers: 0,
      sent: 0,
      failed: 0,
      deactivated: 0,
      skipped: 'no_previous_weeks',
    });
  }

  const years = Array.from(new Set(Array.from(weekInfoByUser.values()).map((week) => week.year)));
  const months = Array.from(new Set(Array.from(weekInfoByUser.values()).map((week) => week.month)));
  const weekNumbers = Array.from(new Set(Array.from(weekInfoByUser.values()).map((week) => week.weekNumber)));

  const [
    { data: transitionRows, error: transitionError },
    { data: entryRows, error: entryError },
  ] = await Promise.all([
    supabase
      .from('quick_expense_week_transitions')
      .select('user_id,year,month,week_number,carry_over,acknowledged_at')
      .in('user_id', Array.from(weekInfoByUser.keys()))
      .in('year', years)
      .in('month', months)
      .in('week_number', weekNumbers)
      .not('acknowledged_at', 'is', null)
      .gt('carry_over', 0),
    supabase
      .from('flow_savings_entries')
      .select('user_id,year,month,week_number')
      .in('user_id', Array.from(weekInfoByUser.keys()))
      .in('year', years)
      .in('month', months)
      .in('week_number', weekNumbers),
  ]);

  if (transitionError || entryError) {
    return NextResponse.json({ error: 'Kunne ikke finde ventende Sparet-uger' }, { status: 500 });
  }

  const recordedWeeks = new Set(
    ((entryRows ?? []) as Array<{ user_id: string; year: number; month: number; week_number: number }>)
      .map((row) => `${row.user_id}:${row.year}-${row.month}-${row.week_number}`)
  );

  const candidates: FlowSavingsCandidate[] = [];

  for (const row of (transitionRows ?? []) as Array<{
    user_id: string;
    year: number;
    month: number;
    week_number: number;
    carry_over: number;
  }>) {
    const weekInfo = weekInfoByUser.get(row.user_id);
    if (!weekInfo) continue;
    if (
      weekInfo.year !== row.year ||
      weekInfo.month !== row.month ||
      weekInfo.weekNumber !== row.week_number
    ) {
      continue;
    }

    const weekEntryKey = `${row.user_id}:${row.year}-${row.month}-${row.week_number}`;
    if (recordedWeeks.has(weekEntryKey)) continue;
    if (Number(row.carry_over) <= 0) continue;

    candidates.push({
      userId: row.user_id,
      weekKey: weekInfo.weekKey,
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
      skipped: 'no_pending_flow_savings',
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
      error: result?.error || 'Kunne ikke sende Sparet-push',
    }, { status: response.status });
  }

  await supabase
    .from('push_notification_user_state')
    .upsert(
      candidates.map((candidate) => ({
        notification_key: 'flow_savings',
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
