import { NextRequest, NextResponse } from 'next/server';

import {
  getPushNotificationDefinition,
  type PushNotificationKey,
  type PushScheduleType,
  type StreakRiskTriggerCondition,
} from '@/lib/push-notifications';
import { createSupabaseRouteClient, createSupabaseServiceClient } from '@/lib/supabase-server';

type UpdatePushConfigBody = {
  key?: PushNotificationKey;
  enabled?: boolean;
  autoSendEnabled?: boolean;
  messageTitle?: string;
  messageBody?: string;
  scheduleType?: PushScheduleType;
  sendDayOfWeek?: number | null;
  sendDayOfMonth?: number | null;
  sendHour?: number;
  sendMinute?: number;
  timezone?: string;
  triggerCondition?: StreakRiskTriggerCondition;
  deliveryWindowStartHour?: number;
  deliveryWindowEndHour?: number;
};

function isAdminUser(user: { app_metadata?: Record<string, unknown> | null } | null) {
  return user?.app_metadata?.is_admin === true || user?.app_metadata?.role === 'admin';
}

function isValidHour(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 23;
}

function isValidMinute(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 59;
}

function isValidTriggerCondition(value: string | undefined): value is StreakRiskTriggerCondition {
  return value === 'close' || value === 'over' || value === 'both';
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

  const body = (await request.json().catch(() => ({}))) as UpdatePushConfigBody;
  const definition = body.key ? getPushNotificationDefinition(body.key) : null;

  if (!definition) {
    return NextResponse.json({ error: 'Ukendt push-type' }, { status: 400 });
  }

  const scheduleType = body.scheduleType ?? definition.defaultScheduleType;
  const messageTitle = body.messageTitle?.trim() || definition.defaultMessageTitle;
  const messageBody = body.messageBody?.trim() || definition.defaultMessageBody;

  if (!definition.supportedScheduleTypes.includes(scheduleType)) {
    return NextResponse.json({ error: 'Ugyldig plan-type for denne push' }, { status: 400 });
  }

  if (!messageTitle) {
    return NextResponse.json({ error: 'Titel må ikke være tom' }, { status: 400 });
  }

  if (!messageBody) {
    return NextResponse.json({ error: 'Brødtekst må ikke være tom' }, { status: 400 });
  }

  if (!isValidHour(body.sendHour ?? definition.defaultSendHour)) {
    return NextResponse.json({ error: 'Ugyldig time' }, { status: 400 });
  }

  if (!isValidMinute(body.sendMinute ?? definition.defaultSendMinute)) {
    return NextResponse.json({ error: 'Ugyldig minut' }, { status: 400 });
  }

  const deliveryWindowStartHour = body.deliveryWindowStartHour ?? definition.defaultDeliveryWindowStartHour;
  const deliveryWindowEndHour = body.deliveryWindowEndHour ?? definition.defaultDeliveryWindowEndHour;
  const triggerCondition = body.triggerCondition ?? definition.defaultTriggerCondition;

  if (!isValidHour(deliveryWindowStartHour) || !isValidHour(deliveryWindowEndHour)) {
    return NextResponse.json({ error: 'Ugyldigt tidsrum for levering' }, { status: 400 });
  }

  if (definition.automationMode === 'event') {
    if (!isValidTriggerCondition(triggerCondition)) {
      return NextResponse.json({ error: 'Ugyldig trigger-betingelse' }, { status: 400 });
    }

    if (deliveryWindowStartHour === deliveryWindowEndHour) {
      return NextResponse.json({ error: 'Start- og sluttid må ikke være identiske' }, { status: 400 });
    }
  }

  if (definition.automationMode === 'scheduled' && scheduleType === 'weekly') {
    const day = body.sendDayOfWeek;
    if (!Number.isInteger(day) || (day ?? -1) < 0 || (day ?? 99) > 6) {
      return NextResponse.json({ error: 'Vælg en gyldig ugedag' }, { status: 400 });
    }
  }

  if (definition.automationMode === 'scheduled' && scheduleType === 'monthly') {
    const day = body.sendDayOfMonth;
    if (!Number.isInteger(day) || (day ?? 0) < 1 || (day ?? 99) > 31) {
      return NextResponse.json({ error: 'Vælg en gyldig dato i måneden' }, { status: 400 });
    }
  }

  const supabase = createSupabaseServiceClient();

  const { error } = await supabase
    .from('push_notification_configs')
    .upsert({
      key: definition.key,
      is_enabled: body.enabled ?? definition.defaultEnabled,
      auto_send_enabled: body.autoSendEnabled ?? definition.defaultAutoSendEnabled,
      message_title: messageTitle,
      message_body: messageBody,
      schedule_type: scheduleType,
      send_day_of_week: scheduleType === 'weekly' ? body.sendDayOfWeek ?? definition.defaultSendDayOfWeek : null,
      send_day_of_month: scheduleType === 'monthly' ? body.sendDayOfMonth ?? definition.defaultSendDayOfMonth : null,
      send_hour: body.sendHour ?? definition.defaultSendHour,
      send_minute: body.sendMinute ?? definition.defaultSendMinute,
      timezone: body.timezone ?? definition.defaultTimezone,
      trigger_condition: triggerCondition,
      delivery_window_start_hour: deliveryWindowStartHour,
      delivery_window_end_hour: deliveryWindowEndHour,
    } as any, { onConflict: 'key' });

  if (error) {
    return NextResponse.json({ error: 'Kunne ikke gemme push-indstillinger' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
