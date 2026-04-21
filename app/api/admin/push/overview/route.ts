import { NextRequest, NextResponse } from 'next/server';

import {
  getDefaultPushNotificationConfig,
  PUSH_NOTIFICATION_DEFINITIONS,
  resolvePushNotificationMessage,
  type PushNotificationConfigRow,
} from '@/lib/push-notifications';
import { createSupabaseRouteClient, createSupabaseServiceClient } from '@/lib/supabase-server';

function isAdminUser(user: { app_metadata?: Record<string, unknown> | null } | null) {
  return user?.app_metadata?.is_admin === true || user?.app_metadata?.role === 'admin';
}

export async function GET(request: NextRequest) {
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

  const supabase = createSupabaseServiceClient();

  const [
    totalResult,
    activeResult,
    recentResult,
    failingResult,
    configResult,
  ] = await Promise.all([
    supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true }),
    supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .gte('last_seen_at', new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString()),
    supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .gt('failure_count', 0),
    supabase
      .from('push_notification_configs')
      .select('key,is_enabled,auto_send_enabled,message_title,message_body,schedule_type,send_day_of_week,send_day_of_month,send_hour,send_minute,timezone,last_sent_at,last_result'),
  ]);

  const errors = [totalResult.error, activeResult.error, recentResult.error, failingResult.error].filter(Boolean);

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Kunne ikke hente push-overblik' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    metrics: {
      totalSubscriptions: totalResult.count ?? 0,
      activeSubscriptions: activeResult.count ?? 0,
      seenLast7Days: recentResult.count ?? 0,
      failingSubscriptions: failingResult.count ?? 0,
    },
    notifications: PUSH_NOTIFICATION_DEFINITIONS.map((definition) => {
      const storedConfig = configResult.error
        ? null
        : (configResult.data as PushNotificationConfigRow[] | null)?.find((row) => row.key === definition.key);
      const config = storedConfig ?? getDefaultPushNotificationConfig(definition);
      const message = resolvePushNotificationMessage(definition, config);

      return {
        key: definition.key,
        title: definition.title,
        description: definition.description,
        audience: definition.audience,
        status: definition.status,
        enabled: config.is_enabled,
        messageTitle: message.title,
        messageBody: message.body,
        supportsAuto: definition.supportsAuto,
        supportedScheduleTypes: definition.supportedScheduleTypes,
        autoSendEnabled: config.auto_send_enabled,
        scheduleType: config.schedule_type,
        sendDayOfWeek: config.send_day_of_week,
        sendDayOfMonth: config.send_day_of_month,
        sendHour: config.send_hour,
        sendMinute: config.send_minute,
        timezone: config.timezone,
        lastSentAt: config.last_sent_at,
        lastResult: config.last_result,
      };
    }),
  });
}
