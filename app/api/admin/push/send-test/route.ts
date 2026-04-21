import { NextRequest, NextResponse } from 'next/server';

import { getPushNotificationDefinition, resolvePushNotificationMessage, type PushNotificationConfigRow } from '@/lib/push-notifications';
import { createSupabaseRouteClient, createSupabaseServiceClient } from '@/lib/supabase-server';

function isAdminUser(user: { app_metadata?: Record<string, unknown> | null } | null) {
  return user?.app_metadata?.is_admin === true || user?.app_metadata?.role === 'admin';
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  if (!authorization) {
    return NextResponse.json({ error: 'Mangler login' }, { status: 401 });
  }

  const routeClient = createSupabaseRouteClient(authorization);
  const { data: { user }, error: userError } = await routeClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Ugyldigt login' }, { status: 401 });
  }

  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Kun admin har adgang' }, { status: 403 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const secret = process.env.KUVERT_PUSH_SECRET || process.env.CRON_SECRET;
  const definition = getPushNotificationDefinition('test_all_users');

  if (!secret || !definition) {
    return NextResponse.json({ error: 'KUVERT_PUSH_SECRET mangler på serveren' }, { status: 500 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: configData } = await supabase
    .from('push_notification_configs')
    .select('message_title,message_body')
    .eq('key', 'test_all_users')
    .maybeSingle();

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
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return NextResponse.json({
      error: data?.error || 'Kunne ikke sende test push',
    }, { status: response.status });
  }

  return NextResponse.json({
    ok: true,
    result: data,
  });
}
