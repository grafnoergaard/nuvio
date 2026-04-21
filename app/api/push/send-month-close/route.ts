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

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 });
  }

  const secret = process.env.KUVERT_PUSH_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'KUVERT_PUSH_SECRET mangler på serveren' }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const definition = getPushNotificationDefinition('month_close');

  if (!definition) {
    return NextResponse.json({ error: 'Månedsluk-push definition mangler' }, { status: 500 });
  }

  const supabase = createSupabaseServiceClient();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [
    { data: subscriptionRows, error: subscriptionError },
    { data: budgetRows, error: budgetError },
    { data: configData },
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
      .from('push_notification_configs')
      .select('message_title,message_body')
      .eq('key', 'month_close')
      .maybeSingle(),
  ]);

  if (subscriptionError || budgetError) {
    return NextResponse.json({ error: 'Kunne ikke hente brugere til månedsluk-push' }, { status: 500 });
  }

  const activeSubscriptionUsers = new Set((subscriptionRows ?? []).map((row) => row.user_id).filter(Boolean));
  const targetedUserIds = Array.from(
    new Set(
      (budgetRows ?? [])
        .map((row) => row.user_id)
        .filter((userId) => userId && activeSubscriptionUsers.has(userId))
    )
  );

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
    (configData ?? null) as Pick<PushNotificationConfigRow, 'message_title' | 'message_body'> | null
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
      error: result?.error || 'Kunne ikke sende månedsluk-push',
    }, { status: response.status });
  }

  return NextResponse.json({
    ok: true,
    targetedUsers: targetedUserIds.length,
    ...result,
  });
}
