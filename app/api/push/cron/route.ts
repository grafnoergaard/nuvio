import { NextRequest, NextResponse } from 'next/server';

import {
  getPushNotificationDefinition,
  PUSH_NOTIFICATION_DEFINITIONS,
  resolvePushNotificationMessage,
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

async function readJsonResponse(response: Response) {
  const text = await response.text().catch(() => '');

  if (!text) {
    return {
      data: {},
      errorMessage: `HTTP ${response.status} uden fejltekst`,
    };
  }

  try {
    const data = JSON.parse(text);
    const errorMessage = typeof data?.error === 'string'
      ? data.error
      : typeof data?.message === 'string'
        ? data.message
        : `HTTP ${response.status}: ${text.slice(0, 160)}`;

    return { data, errorMessage };
  } catch {
    return {
      data: {},
      errorMessage: `HTTP ${response.status}: ${text.slice(0, 160)}`,
    };
  }
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

  if (config.schedule_type === 'weekly') {
    return config.send_day_of_week === localNow.dayOfWeek;
  }

  if (config.schedule_type === 'monthly') {
    return config.send_day_of_month === localNow.day;
  }

  return false;
}

function wasAlreadySentToday(config: PushNotificationConfigRow, now: Date) {
  if (!config.last_sent_at) return false;

  const lastLocal = getLocalTimeParts(new Date(config.last_sent_at), config.timezone);
  const nowLocal = getLocalTimeParts(now, config.timezone);

  return (
    lastLocal.year === nowLocal.year &&
    lastLocal.month === nowLocal.month &&
    lastLocal.day === nowLocal.day
  );
}

function getSpecialPushRoute(key: PushNotificationKey) {
  const routes: Partial<Record<PushNotificationKey, string>> = {
    week_budget_setup: '/api/push/send-week-budget-setup',
    week_transition: '/api/push/send-week-transition',
    flow_savings: '/api/push/send-flow-savings',
    streak_risk: '/api/push/send-streak-risk',
    weekly_budget_low: '/api/push/send-weekly-budget-low',
    month_close: '/api/push/send-month-close',
    score_drop: '/api/push/send-score-drop',
    score_strong: '/api/push/send-score-strong',
    good_grip: '/api/push/send-good-grip',
    honest_entries: '/api/push/send-honest-entries',
    single_account_method: '/api/push/send-single-account-method',
  };

  return routes[key] ?? null;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 });
  }

  const secret = process.env.CRON_SECRET || process.env.KUVERT_PUSH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'KUVERT_PUSH_SECRET eller CRON_SECRET mangler' }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const supabase = createSupabaseServiceClient();
  const now = new Date();

  const { data, error } = await supabase
    .from('push_notification_configs')
    .select('key,is_enabled,auto_send_enabled,message_title,message_body,schedule_type,send_day_of_week,send_day_of_month,send_hour,send_minute,timezone,trigger_condition,delivery_window_start_hour,delivery_window_end_hour,last_sent_at,last_result');

  if (error) {
    return NextResponse.json({ error: 'Kunne ikke hente push-konfigurationer' }, { status: 500 });
  }

  const configs = (data ?? []) as PushNotificationConfigRow[];
  const dueConfigs = configs.filter((config) => {
    const definition = getPushNotificationDefinition(config.key);
    if (!definition?.supportsAuto) return false;
    if (definition.automationMode === 'event') {
      return config.is_enabled && config.auto_send_enabled && !wasAlreadySentToday(config, now);
    }
    return isDue(config, now) && !wasAlreadySentToday(config, now);
  });

  const results = await Promise.all(dueConfigs.map(async (config) => {
    const definition = getPushNotificationDefinition(config.key);
    if (!definition) {
      return {
        key: config.key,
        ok: false,
        responseStatus: 400,
        result: { error: 'Ukendt push-definition' },
      };
    }

    const specialRoute = getSpecialPushRoute(config.key);
    const payload = resolvePushNotificationMessage(definition, config);
    const response = await fetch(
      new URL(specialRoute ?? '/api/push/send', appUrl),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-kuvert-push-secret': secret,
        },
        body: specialRoute ? undefined : JSON.stringify(payload),
      }
    );

    const { data: result, errorMessage } = await readJsonResponse(response);
    const ok = response.ok;

    const targetedCount = Number(result?.targeted ?? result?.targetedUsers ?? 0);
    const sentCount = Number(result?.sent ?? 0);
    const nextLastSentAt = ok && targetedCount > 0 ? now.toISOString() : config.last_sent_at;
    const nextLastResult = ok
      ? targetedCount > 0
        ? `Sendt ${sentCount}/${targetedCount}`
        : 'Ingen brugere matchede triggeren'
      : `Fejl: ${errorMessage}`;

    await supabase
      .from('push_notification_configs')
      .update({
        last_sent_at: nextLastSentAt,
        last_result: nextLastResult,
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
