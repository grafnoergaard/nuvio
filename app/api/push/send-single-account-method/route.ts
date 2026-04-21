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

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function getLocalDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';

  return {
    year: Number(part('year')),
    month: Number(part('month')),
    day: Number(part('day')),
  };
}

function isAssignedRandomDay(userId: string, notificationKey: string, now: Date, timeZone: string) {
  const { year, month, day } = getLocalDateParts(now, timeZone);
  const daysInMonth = new Date(year, month, 0).getDate();
  const targetDay = (hashString(`${notificationKey}:${userId}:${year}-${month}`) % daysInMonth) + 1;
  return targetDay === day;
}

function hasCooldownPassed(lastSentAt: string | null, now: Date, cooldownDays: number) {
  if (!lastSentAt) return true;
  const diffMs = now.getTime() - new Date(lastSentAt).getTime();
  return diffMs >= cooldownDays * 24 * 60 * 60 * 1000;
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
  const definition = getPushNotificationDefinition('single_account_method');
  if (!definition) {
    return NextResponse.json({ error: 'Én konto-push definition mangler' }, { status: 500 });
  }

  const supabase = createSupabaseServiceClient();
  const now = new Date();

  const [
    { data: subscriptionRows, error: subscriptionError },
    { data: budgetRows, error: budgetError },
    { data: expenseRows, error: expenseError },
    { data: configData },
    { data: deliveryStateRows, error: deliveryStateError },
  ] = await Promise.all([
    supabase.from('push_subscriptions').select('user_id').eq('is_active', true),
    supabase
      .from('quick_expense_monthly_budgets')
      .select('user_id,budget_amount')
      .gt('budget_amount', 0),
    supabase
      .from('quick_expenses')
      .select('user_id,expense_date')
      .gte('expense_date', new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    supabase
      .from('push_notification_configs')
      .select('message_title,message_body,delivery_window_start_hour,delivery_window_end_hour,timezone')
      .eq('key', 'single_account_method')
      .maybeSingle(),
    supabase
      .from('push_notification_user_state')
      .select('user_id,last_sent_at')
      .eq('notification_key', 'single_account_method'),
  ]);

  if (subscriptionError || budgetError || expenseError || deliveryStateError) {
    return NextResponse.json({ error: 'Kunne ikke beregne én konto-push' }, { status: 500 });
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

  const activeSubscriptionUsers = new Set((subscriptionRows ?? []).map((row) => row.user_id).filter(Boolean));
  const recentExpenseUsers = new Set((expenseRows ?? []).map((row) => row.user_id).filter(Boolean));
  const deliveryStateByUser = new Map<string, { last_sent_at: string | null }>();
  for (const row of (deliveryStateRows ?? []) as Array<{ user_id: string; last_sent_at: string | null }>) {
    deliveryStateByUser.set(row.user_id, { last_sent_at: row.last_sent_at });
  }

  const uniqueBudgetUsers = new Set(
    ((budgetRows ?? []) as Array<{ user_id: string; budget_amount: number }>)
      .map((row) => row.user_id)
      .filter(Boolean)
  );

  const candidates = Array.from(uniqueBudgetUsers)
    .filter((userId) => activeSubscriptionUsers.has(userId))
    .filter((userId) => recentExpenseUsers.has(userId))
    .filter((userId) => isAssignedRandomDay(userId, 'single_account_method', now, timeZone))
    .filter((userId) => hasCooldownPassed(deliveryStateByUser.get(userId)?.last_sent_at ?? null, now, 24));

  if (candidates.length === 0) {
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
      userIds: candidates,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    return NextResponse.json({ error: result?.error || 'Kunne ikke sende én konto-push' }, { status: response.status });
  }

  await supabase
    .from('push_notification_user_state')
    .upsert(
      candidates.map((userId) => ({
        notification_key: 'single_account_method',
        user_id: userId,
        last_sent_at: now.toISOString(),
        last_sent_week_key: now.toISOString().slice(0, 10),
        last_sent_condition: 'random_method',
      })) as any,
      { onConflict: 'notification_key,user_id' }
    );

  return NextResponse.json({
    ok: true,
    targetedUsers: candidates.length,
    ...result,
  });
}
