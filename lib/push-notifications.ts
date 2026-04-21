export type PushNotificationKey =
  | 'test_all_users'
  | 'weekly_budget_reminder'
  | 'streak_risk'
  | 'month_close';

export type PushScheduleType = 'manual' | 'weekly' | 'monthly';

export interface PushNotificationDefinition {
  key: PushNotificationKey;
  title: string;
  description: string;
  audience: string;
  status: string;
  defaultMessageTitle: string;
  defaultMessageBody: string;
  defaultUrl: string;
  previewUrl?: string | null;
  supportsAuto: boolean;
  supportedScheduleTypes: PushScheduleType[];
  defaultScheduleType: PushScheduleType;
  defaultEnabled: boolean;
  defaultAutoSendEnabled: boolean;
  defaultSendDayOfWeek: number | null;
  defaultSendDayOfMonth: number | null;
  defaultSendHour: number;
  defaultSendMinute: number;
  defaultTimezone: string;
}

export interface PushNotificationConfigRow {
  key: PushNotificationKey;
  is_enabled: boolean;
  auto_send_enabled: boolean;
  message_title: string | null;
  message_body: string | null;
  schedule_type: PushScheduleType;
  send_day_of_week: number | null;
  send_day_of_month: number | null;
  send_hour: number;
  send_minute: number;
  timezone: string;
  last_sent_at: string | null;
  last_result: string | null;
}

export const PUSH_NOTIFICATION_DEFINITIONS: PushNotificationDefinition[] = [
  {
    key: 'test_all_users',
    title: 'Test push',
    description: 'Sender en enkel testbesked til alle aktive push-modtagere.',
    audience: 'Alle aktive brugere',
    status: 'Klar',
    defaultMessageTitle: 'Kuvert test',
    defaultMessageBody: 'Det her er en test fra admin. Nu ved vi, at push-laget virker.',
    defaultUrl: '/',
    previewUrl: '/',
    supportsAuto: false,
    supportedScheduleTypes: ['manual'],
    defaultScheduleType: 'manual',
    defaultEnabled: true,
    defaultAutoSendEnabled: false,
    defaultSendDayOfWeek: null,
    defaultSendDayOfMonth: null,
    defaultSendHour: 9,
    defaultSendMinute: 0,
    defaultTimezone: 'Europe/Copenhagen',
  },
  {
    key: 'weekly_budget_reminder',
    title: 'Ugebudget-påmindelse',
    description: 'Åbner et lille uge-flow med status, per-dag retning og et klart næste skridt.',
    audience: 'Brugere med aktiv Kuvert',
    status: 'Klar',
    defaultMessageTitle: 'Ugens Kuvert',
    defaultMessageBody: 'Se hvor du står i denne uge - og hvad dit bedste næste skridt er.',
    defaultUrl: '/?flow=weekly-budget-reminder',
    previewUrl: '/?flow=weekly-budget-reminder',
    supportsAuto: true,
    supportedScheduleTypes: ['weekly'],
    defaultScheduleType: 'weekly',
    defaultEnabled: true,
    defaultAutoSendEnabled: false,
    defaultSendDayOfWeek: 3,
    defaultSendDayOfMonth: null,
    defaultSendHour: 11,
    defaultSendMinute: 0,
    defaultTimezone: 'Europe/Copenhagen',
  },
  {
    key: 'streak_risk',
    title: 'Streak i fare',
    description: 'En blid besked der kalder brugeren ind, før rytmen ryger helt.',
    audience: 'Brugere tæt på budgetgrænse',
    status: 'Klar',
    defaultMessageTitle: 'Pas på din rytme',
    defaultMessageBody: 'Et hurtigt tjek nu kan hjælpe dig med at holde uge-rytmen i live.',
    defaultUrl: '/?flow=weekly-budget-reminder',
    previewUrl: '/?flow=weekly-budget-reminder',
    supportsAuto: true,
    supportedScheduleTypes: ['weekly'],
    defaultScheduleType: 'weekly',
    defaultEnabled: true,
    defaultAutoSendEnabled: false,
    defaultSendDayOfWeek: 4,
    defaultSendDayOfMonth: null,
    defaultSendHour: 16,
    defaultSendMinute: 0,
    defaultTimezone: 'Europe/Copenhagen',
  },
  {
    key: 'month_close',
    title: 'Måneden lukker snart',
    description: 'Minder brugeren om at lande blødt i slutningen af måneden.',
    audience: 'Aktive brugere sidst på måneden',
    status: 'Klar',
    defaultMessageTitle: 'Måneden lukker snart',
    defaultMessageBody: 'Tag et roligt kig på Kuvert nu, så du lander godt i slutningen af måneden.',
    defaultUrl: '/udgifter',
    previewUrl: '/udgifter',
    supportsAuto: true,
    supportedScheduleTypes: ['monthly'],
    defaultScheduleType: 'monthly',
    defaultEnabled: true,
    defaultAutoSendEnabled: false,
    defaultSendDayOfWeek: null,
    defaultSendDayOfMonth: 25,
    defaultSendHour: 9,
    defaultSendMinute: 0,
    defaultTimezone: 'Europe/Copenhagen',
  },
];

export function getDefaultPushNotificationConfig(
  definition: PushNotificationDefinition
): PushNotificationConfigRow {
  return {
    key: definition.key,
    is_enabled: definition.defaultEnabled,
    auto_send_enabled: definition.defaultAutoSendEnabled,
    message_title: definition.defaultMessageTitle,
    message_body: definition.defaultMessageBody,
    schedule_type: definition.defaultScheduleType,
    send_day_of_week: definition.defaultSendDayOfWeek,
    send_day_of_month: definition.defaultSendDayOfMonth,
    send_hour: definition.defaultSendHour,
    send_minute: definition.defaultSendMinute,
    timezone: definition.defaultTimezone,
    last_sent_at: null,
    last_result: null,
  };
}

export function getPushNotificationDefinition(key: PushNotificationKey) {
  return PUSH_NOTIFICATION_DEFINITIONS.find((definition) => definition.key === key) ?? null;
}

export function resolvePushNotificationMessage(
  definition: PushNotificationDefinition,
  config?: Pick<PushNotificationConfigRow, 'message_title' | 'message_body'> | null
) {
  return {
    title: config?.message_title?.trim() || definition.defaultMessageTitle,
    body: config?.message_body?.trim() || definition.defaultMessageBody,
    url: definition.defaultUrl,
  };
}
