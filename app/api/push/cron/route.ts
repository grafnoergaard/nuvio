import { NextRequest, NextResponse } from 'next/server';

import {
  getPushNotificationDefinition,
  PUSH_NOTIFICATION_DEFINITIONS,
  type PushNotificationConfigRow,
  type PushNotificationKey,
} from '@/lib/push-notifications';
import { createSupabaseServiceClient } from '@/lib/supabase-server';

type LocalTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
};

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function isAuthorized(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET || process.env.KUVERT_PUSH_SECRET;
  if (!expectedSecret) return false;

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const headerSecret = request.headers.get('x-kuvert-push-secret');

  return bearer === expectedSecret || headerSecret === expectedSecret;
}

function getLocalTimeParts(date: Date, timeZone: string): LocalTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';

  return {
    year: Number(part('year')),
    month: Number(part('month')),
    day: Number(part('day')),
    hour: Number(part('hour')),
    minute: Number(part('minute')),
    dayOfWeek: WEEKDAY_MAP[part('weekday')] ?? 0,
  };
}

function isDue(config: PushNotificationConfigRow, now: Date) {
  if (!config.is_enabled || !config.auto_send_enabled) return false;

  const localNow = getLocalTimeParts(now, config.timezone);

  if (localNow.hour !== config.send_hour || localNow.minute !== config.send_minute) {
    return false;
  }

  if (config.schedule_type === 'weekly') {
    return config.send_day_of_week === localNow.dayOfWeek;
  }

  if (config.schedule_type === 'monthly') {
    return config.send_day_of_month === localNow.day;
  }

  return false;
}

function wasAlreadySentThisSlot(config: PushNotificationConfigRow, now: Date) {
  if (!config.last_sent_at) return false;

  const lastLocal = getLocalTimeParts(new Date(config.last_sent_at), config.timezone);
  const nowLocal = getLocalTimeParts(now, config.timezone);

  return (
    lastLocal.year === nowLocal.year &&
    lastLocal.month === nowLocal.month &&
    lastLocal.day === nowLocal.day &&
    lastLocal.hour === nowLocal.hour &&
    lastLocal.minute === nowLocal.minute
  );
}

function getPayloadForNotification(key: PushNotificationKey) {
  switch (key) {
    case 'weekly_budget_reminder':
      return {
        title: 'Ugens Kuvert',
        body: 'Se hvor du står i denne uge - og hvad dit bedste næste skridt er.',
        url: '/?flow=weekly-budget-reminder',
      };
    case 'streak_risk':
      return {
        title: 'Pas på din rytme',
        body: 'Et hurtigt tjek nu kan hjælpe dig med at holde uge-rytmen i live.',
        url: '/?flow=weekly-budget-reminder',
      };
    case 'month_close':
      return {
        title: 'Måneden lukker snart',
        body: 'Tag et roligt kig på Kuvert nu, så du lander godt i slutningen af måneden.',
        url: '/udgifter',
      };
    case 'test_all_users':
    default:
      return {
        title: 'Kuvert test',
        body: 'Det her er en test fra admin. Nu ved vi, at push-laget virker.',
        url: '/',
      };
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 });
  }

  const secret = process.env.KUVERT_PUSH_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'KUVERT_PUSH_SECRET eller CRON_SECRET mangler' }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const supabase = createSupabaseServiceClient();
  const now = new Date();

  const { data, error } = await supabase
    .from('push_notification_configs')
    .select('key,is_enabled,auto_send_enabled,schedule_type,send_day_of_week,send_day_of_month,send_hour,send_minute,timezone,last_sent_at,last_result');

  if (error) {
    return NextResponse.json({ error: 'Kunne ikke hente push-konfigurationer' }, { status: 500 });
  }

  const configs = (data ?? []) as PushNotificationConfigRow[];
  const dueConfigs = configs.filter((config) => {
    const definition = getPushNotificationDefinition(config.key);
    if (!definition?.supportsAuto) return false;
    return isDue(config, now) && !wasAlreadySentThisSlot(config, now);
  });

  const results = await Promise.all(dueConfigs.map(async (config) => {
    const payload = getPayloadForNotification(config.key);
    const response = await fetch(new URL('/api/push/send', appUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kuvert-push-secret': secret,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    const ok = response.ok;

    await supabase
      .from('push_notification_configs')
      .update({
        last_sent_at: ok ? now.toISOString() : config.last_sent_at,
        last_result: ok
          ? `Sendt ${result?.sent ?? 0}/${result?.targeted ?? 0}`
          : `Fejl: ${result?.error || 'Ukendt fejl'}`,
      } as any)
      .eq('key', config.key);

    return {
      key: config.key,
      ok,
      responseStatus: response.status,
      result,
    };
  }));

  return NextResponse.json({
    ok: true,
    checked: configs.length,
    due: dueConfigs.map((config) => config.key),
    results,
    available: PUSH_NOTIFICATION_DEFINITIONS.map((definition) => definition.key),
  });
}
