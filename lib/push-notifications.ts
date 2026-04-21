export type PushNotificationKey =
  | 'test_all_users'
  | 'weekly_budget_reminder'
  | 'streak_risk'
  | 'month_close'
  | 'score_drop'
  | 'score_strong'
  | 'good_grip'
  | 'honest_entries'
  | 'single_account_method';

export type PushScheduleType = 'manual' | 'weekly' | 'monthly';
export type PushAutomationMode = 'scheduled' | 'event';
export type StreakRiskTriggerCondition = 'close' | 'over' | 'both';

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
  automationMode: PushAutomationMode;
  defaultTriggerCondition: StreakRiskTriggerCondition;
  defaultDeliveryWindowStartHour: number;
  defaultDeliveryWindowEndHour: number;
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
  trigger_condition: StreakRiskTriggerCondition;
  delivery_window_start_hour: number;
  delivery_window_end_hour: number;
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
    automationMode: 'scheduled',
    defaultTriggerCondition: 'both',
    defaultDeliveryWindowStartHour: 9,
    defaultDeliveryWindowEndHour: 20,
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
    automationMode: 'scheduled',
    defaultTriggerCondition: 'both',
    defaultDeliveryWindowStartHour: 9,
    defaultDeliveryWindowEndHour: 20,
  },
  {
    key: 'streak_risk',
    title: 'Streak i fare',
    description: 'En blid besked der kalder brugeren ind, før rytmen ryger helt.',
    audience: 'Brugere tæt på budgetgrænse',
    status: 'Klar',
    defaultMessageTitle: 'Pas på din rytme',
    defaultMessageBody: 'Et hurtigt tjek nu kan hjælpe dig med at holde uge-rytmen i live.',
    defaultUrl: '/?flow=streak-risk',
    previewUrl: '/?flow=streak-risk',
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
    automationMode: 'event',
    defaultTriggerCondition: 'both',
    defaultDeliveryWindowStartHour: 9,
    defaultDeliveryWindowEndHour: 20,
  },
  {
    key: 'month_close',
    title: 'Måneden lukker snart',
    description: 'Minder brugeren om at lande blødt i slutningen af måneden.',
    audience: 'Aktive brugere sidst på måneden',
    status: 'Klar',
    defaultMessageTitle: 'Måneden lukker snart',
    defaultMessageBody: 'Tag et roligt kig på Kuvert nu, så du lander godt i slutningen af måneden.',
    defaultUrl: '/?flow=month-close',
    previewUrl: '/?flow=month-close',
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
    automationMode: 'scheduled',
    defaultTriggerCondition: 'both',
    defaultDeliveryWindowStartHour: 9,
    defaultDeliveryWindowEndHour: 20,
  },
  {
    key: 'score_drop',
    title: 'Score falder',
    description: 'Kalder brugeren ind, når månedsscoren glider ned i en zone, der er værd at reagere på.',
    audience: 'Brugere hvor månedsscoren er i gul eller rød zone',
    status: 'Klar',
    defaultMessageTitle: 'Din score kalder på et hurtigt tjek',
    defaultMessageBody: 'Et roligt kig nu kan hjælpe dig med at løfte din score igen, mens måneden stadig er i dine hænder.',
    defaultUrl: '/?flow=score-drop',
    previewUrl: '/?flow=score-drop',
    supportsAuto: true,
    supportedScheduleTypes: ['weekly'],
    defaultScheduleType: 'weekly',
    defaultEnabled: true,
    defaultAutoSendEnabled: false,
    defaultSendDayOfWeek: 1,
    defaultSendDayOfMonth: null,
    defaultSendHour: 10,
    defaultSendMinute: 0,
    defaultTimezone: 'Europe/Copenhagen',
    automationMode: 'event',
    defaultTriggerCondition: 'both',
    defaultDeliveryWindowStartHour: 9,
    defaultDeliveryWindowEndHour: 20,
  },
  {
    key: 'score_strong',
    title: 'Din score er stærk',
    description: 'En positiv besked der forstærker, når månedsscoren står stærkt.',
    audience: 'Brugere med høj månedsscore',
    status: 'Klar',
    defaultMessageTitle: 'Din score står stærkt',
    defaultMessageBody: 'Det du gør lige nu virker. Tag et roligt kig og hold fast i rytmen resten af måneden.',
    defaultUrl: '/?flow=score-strong',
    previewUrl: '/?flow=score-strong',
    supportsAuto: true,
    supportedScheduleTypes: ['weekly'],
    defaultScheduleType: 'weekly',
    defaultEnabled: true,
    defaultAutoSendEnabled: false,
    defaultSendDayOfWeek: 1,
    defaultSendDayOfMonth: null,
    defaultSendHour: 11,
    defaultSendMinute: 0,
    defaultTimezone: 'Europe/Copenhagen',
    automationMode: 'event',
    defaultTriggerCondition: 'both',
    defaultDeliveryWindowStartHour: 9,
    defaultDeliveryWindowEndHour: 20,
  },
  {
    key: 'good_grip',
    title: 'Du har godt greb om det',
    description: 'En rolig, positiv besked når brugeren står et sundt sted i måneden.',
    audience: 'Brugere med stabil måned og et godt greb om økonomien',
    status: 'Klar',
    defaultMessageTitle: 'Du har godt greb om det',
    defaultMessageBody: 'Det ser roligt og sundt ud lige nu. Et lille tjek kan hjælpe dig med at bevare retningen resten af måneden.',
    defaultUrl: '/?flow=good-grip',
    previewUrl: '/?flow=good-grip',
    supportsAuto: true,
    supportedScheduleTypes: ['weekly'],
    defaultScheduleType: 'weekly',
    defaultEnabled: true,
    defaultAutoSendEnabled: false,
    defaultSendDayOfWeek: 2,
    defaultSendDayOfMonth: null,
    defaultSendHour: 11,
    defaultSendMinute: 0,
    defaultTimezone: 'Europe/Copenhagen',
    automationMode: 'event',
    defaultTriggerCondition: 'both',
    defaultDeliveryWindowStartHour: 9,
    defaultDeliveryWindowEndHour: 20,
  },
  {
    key: 'honest_entries',
    title: 'Ærlige poster giver ægte overblik',
    description: 'En rolig nudge om at udgifter og rådighedsbeløb kun hjælper, når de matcher virkeligheden.',
    audience: 'Aktive brugere med en levende Kuvert',
    status: 'Klar',
    defaultMessageTitle: 'Kuvert virker kun med ærlige poster',
    defaultMessageBody: 'Når poster og rådighedsbeløb matcher virkeligheden, bliver Kuvert et rigtigt styringsværktøj - ikke bare et pænt billede.',
    defaultUrl: '/?flow=honest-entries',
    previewUrl: '/?flow=honest-entries',
    supportsAuto: true,
    supportedScheduleTypes: ['weekly'],
    defaultScheduleType: 'weekly',
    defaultEnabled: true,
    defaultAutoSendEnabled: false,
    defaultSendDayOfWeek: 2,
    defaultSendDayOfMonth: null,
    defaultSendHour: 11,
    defaultSendMinute: 0,
    defaultTimezone: 'Europe/Copenhagen',
    automationMode: 'event',
    defaultTriggerCondition: 'both',
    defaultDeliveryWindowStartHour: 9,
    defaultDeliveryWindowEndHour: 20,
  },
  {
    key: 'single_account_method',
    title: 'Kør Kuvert fra én konto',
    description: 'En grundprincip-påmindelse om at lade alle variable udgifter gå gennem én konto og spejle beløbet i Kuvert.',
    audience: 'Aktive brugere som arbejder med variable udgifter',
    status: 'Klar',
    defaultMessageTitle: 'Lad Kuvert bo på én konto',
    defaultMessageBody: 'Kuvert virker bedst, når dine variable udgifter kører fra én konto, og månedens beløb bliver spejlet i appen fra start.',
    defaultUrl: '/?flow=single-account-method',
    previewUrl: '/?flow=single-account-method',
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
    automationMode: 'event',
    defaultTriggerCondition: 'both',
    defaultDeliveryWindowStartHour: 9,
    defaultDeliveryWindowEndHour: 20,
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
    trigger_condition: definition.defaultTriggerCondition,
    delivery_window_start_hour: definition.defaultDeliveryWindowStartHour,
    delivery_window_end_hour: definition.defaultDeliveryWindowEndHour,
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
