import { NextRequest, NextResponse } from 'next/server';

import {
  getDefaultPushNotificationConfig,
  PUSH_NOTIFICATION_DEFINITIONS,
  type PushNotificationConfigRow,
  type PushNotificationKey,
} from '@/lib/push-notifications';
import { createSupabaseRouteClient, createSupabaseServiceClient } from '@/lib/supabase-server';

type DiagnosticStatus =
  | 'ready'
  | 'warning'
  | 'disabled'
  | 'no_match'
  | 'missing_env'
  | 'database_error';

const ADMIN_PUSH_ROUTES: Record<PushNotificationKey, string> = {
  test_all_users: '/api/admin/push/send-test',
  weekly_budget_reminder: '/api/admin/push/send-weekly-reminder',
  week_transition: '/api/admin/push/send-week-transition',
  flow_savings: '/api/admin/push/send-flow-savings',
  weekly_budget_low: '/api/admin/push/send-weekly-budget-low',
  streak_risk: '/api/admin/push/send-streak-risk',
  month_close: '/api/admin/push/send-month-close',
  score_drop: '/api/admin/push/send-score-drop',
  score_strong: '/api/admin/push/send-score-strong',
  good_grip: '/api/admin/push/send-good-grip',
  honest_entries: '/api/admin/push/send-honest-entries',
  single_account_method: '/api/admin/push/send-single-account-method',
};

function isAdminUser(user: { app_metadata?: Record<string, unknown> | null } | null) {
  return user?.app_metadata?.is_admin === true || user?.app_metadata?.role === 'admin';
}

function envSnapshot() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    VAPID_PRIVATE_KEY: Boolean(process.env.VAPID_PRIVATE_KEY),
    VAPID_SUBJECT: Boolean(process.env.VAPID_SUBJECT),
    CRON_SECRET: Boolean(process.env.CRON_SECRET || process.env.KUVERT_PUSH_SECRET),
  };
}

function getMissingEnv(env: ReturnType<typeof envSnapshot>) {
  return Object.entries(env)
    .filter(([, exists]) => !exists)
    .map(([key]) => key);
}

function getStatusLabel(status: DiagnosticStatus) {
  switch (status) {
    case 'ready':
      return 'Klar';
    case 'warning':
      return 'Tjek';
    case 'disabled':
      return 'Slået fra';
    case 'no_match':
      return 'Ingen match';
    case 'missing_env':
      return 'Mangler env';
    case 'database_error':
      return 'Databasefejl';
  }
}

function getReadyLabel(supportsAuto: boolean) {
  return supportsAuto ? 'Klar til cron' : 'Klar til manuel';
}

export async function GET(request: NextRequest) {
  const env = envSnapshot();
  const missingEnv = getMissingEnv(env);
  const authorization = request.headers.get('authorization');

  if (!authorization) {
    return NextResponse.json({ error: 'Mangler login' }, { status: 401 });
  }

  let user: { app_metadata?: Record<string, unknown> | null } | null = null;

  try {
    const routeClient = createSupabaseRouteClient(authorization);
    const authResult = await routeClient.auth.getUser();
    user = authResult.data.user;

    if (authResult.error || !user) {
      return NextResponse.json({ error: 'Ugyldigt login' }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Kunne ikke validere admin-login',
      env,
      missingEnv,
    }, { status: 500 });
  }

  if (!isAdminUser(user)) {
    return NextResponse.json({ error: 'Kun admin har adgang' }, { status: 403 });
  }

  let supabase: ReturnType<typeof createSupabaseServiceClient>;

  try {
    supabase = createSupabaseServiceClient();
  } catch (error) {
    const diagnostics = PUSH_NOTIFICATION_DEFINITIONS.map((definition) => ({
      key: definition.key,
      title: definition.title,
      status: 'missing_env' as DiagnosticStatus,
      statusLabel: getStatusLabel('missing_env'),
      detail: error instanceof Error ? error.message : 'Servermiljøet mangler Supabase service role key.',
      route: ADMIN_PUSH_ROUTES[definition.key],
      enabled: definition.defaultEnabled,
      autoSendEnabled: definition.defaultAutoSendEnabled,
      checks: ['Supabase service client kunne ikke oprettes.'],
    }));

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      dryRun: true,
      env,
      missingEnv,
      metrics: {
        activeSubscriptions: 0,
        failingSubscriptions: 0,
        configuredNotifications: 0,
      },
      summary: buildSummary(diagnostics),
      diagnostics,
    });
  }

  const [activeResult, failingResult, configResult] = await Promise.all([
    supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .gt('failure_count', 0),
    supabase
      .from('push_notification_configs')
      .select('key,is_enabled,auto_send_enabled,message_title,message_body,schedule_type,send_day_of_week,send_day_of_month,send_hour,send_minute,timezone,trigger_condition,delivery_window_start_hour,delivery_window_end_hour,last_sent_at,last_result'),
  ]);

  const databaseError = activeResult.error || failingResult.error || configResult.error;

  if (databaseError) {
    const diagnostics = PUSH_NOTIFICATION_DEFINITIONS.map((definition) => ({
      key: definition.key,
      title: definition.title,
      status: 'database_error' as DiagnosticStatus,
      statusLabel: getStatusLabel('database_error'),
      detail: databaseError.message,
      route: ADMIN_PUSH_ROUTES[definition.key],
      enabled: false,
      autoSendEnabled: false,
      checks: ['Databaseforespørgslen fejlede. Ingen push blev sendt.'],
    }));

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      dryRun: true,
      env,
      missingEnv,
      metrics: {
        activeSubscriptions: activeResult.count ?? 0,
        failingSubscriptions: failingResult.count ?? 0,
        configuredNotifications: 0,
      },
      summary: buildSummary(diagnostics),
      diagnostics,
    });
  }

  const activeSubscriptions = activeResult.count ?? 0;
  const failingSubscriptions = failingResult.count ?? 0;
  const configRows = (configResult.data ?? []) as PushNotificationConfigRow[];
  const configByKey = new Map(configRows.map((row) => [row.key, row]));
  const deliveryEnvMissing = missingEnv.filter((key) => (
    key === 'NEXT_PUBLIC_VAPID_PUBLIC_KEY'
    || key === 'VAPID_PRIVATE_KEY'
    || key === 'VAPID_SUBJECT'
  ));

  const diagnostics = PUSH_NOTIFICATION_DEFINITIONS.map((definition) => {
    const storedConfig = configByKey.get(definition.key);
    const config = storedConfig ?? getDefaultPushNotificationConfig(definition);
    const checks: string[] = [
      `Rute fundet: ${ADMIN_PUSH_ROUTES[definition.key]}`,
      `Aktive subscriptions: ${activeSubscriptions}`,
    ];

    if (!storedConfig) {
      checks.push('Ingen gemt config-række. Dry run bruger default-værdier.');
    }

    if (failingSubscriptions > 0) {
      checks.push(`${failingSubscriptions} subscription(s) har tidligere fejlet.`);
    }

    if (!env.CRON_SECRET && definition.supportsAuto) {
      checks.push('CRON_SECRET/KUVERT_PUSH_SECRET mangler. Manuel send kan virke, men cron er ikke beskyttet korrekt.');
    }

    if (deliveryEnvMissing.length > 0) {
      return {
        key: definition.key,
        title: definition.title,
        status: 'missing_env' as DiagnosticStatus,
        statusLabel: getStatusLabel('missing_env'),
        detail: `Mangler ${deliveryEnvMissing.join(', ')}. Afsendelse kan ikke ske før det er sat.`,
        route: ADMIN_PUSH_ROUTES[definition.key],
        enabled: config.is_enabled,
        autoSendEnabled: config.auto_send_enabled,
        checks,
      };
    }

    if (activeSubscriptions === 0) {
      return {
        key: definition.key,
        title: definition.title,
        status: 'no_match' as DiagnosticStatus,
        statusLabel: getStatusLabel('no_match'),
        detail: 'Der er ingen aktive push-modtagere lige nu.',
        route: ADMIN_PUSH_ROUTES[definition.key],
        enabled: config.is_enabled,
        autoSendEnabled: config.auto_send_enabled,
        checks,
      };
    }

    if (!config.is_enabled) {
      return {
        key: definition.key,
        title: definition.title,
        status: 'disabled' as DiagnosticStatus,
        statusLabel: getStatusLabel('disabled'),
        detail: 'Pushen er slået fra i admin. Dry run sender selvfølgelig ingenting.',
        route: ADMIN_PUSH_ROUTES[definition.key],
        enabled: config.is_enabled,
        autoSendEnabled: config.auto_send_enabled,
        checks,
      };
    }

    if (!env.CRON_SECRET && definition.supportsAuto && config.auto_send_enabled) {
      return {
        key: definition.key,
        title: definition.title,
        status: 'warning' as DiagnosticStatus,
        statusLabel: 'Cron-secret mangler',
        detail: 'Pushen er sat til automatisk, men CRON_SECRET/KUVERT_PUSH_SECRET mangler. Manuel send kan stadig virke.',
        route: ADMIN_PUSH_ROUTES[definition.key],
        enabled: config.is_enabled,
        autoSendEnabled: config.auto_send_enabled,
        checks,
      };
    }

    if (definition.supportsAuto && !config.auto_send_enabled) {
      return {
        key: definition.key,
        title: definition.title,
        status: 'warning' as DiagnosticStatus,
        statusLabel: 'Auto slået fra',
        detail: 'Klar til manuel send, men den bliver ikke sendt af sig selv via cron.',
        route: ADMIN_PUSH_ROUTES[definition.key],
        enabled: config.is_enabled,
        autoSendEnabled: config.auto_send_enabled,
        checks,
      };
    }

    if (config.last_result?.toLowerCase().includes('fejl')) {
      return {
        key: definition.key,
        title: definition.title,
        status: 'warning' as DiagnosticStatus,
        statusLabel: 'Sidste send fejlede',
        detail: `Teknisk klar, men sidste registrerede resultat var: ${config.last_result}`,
        route: ADMIN_PUSH_ROUTES[definition.key],
        enabled: config.is_enabled,
        autoSendEnabled: config.auto_send_enabled,
        checks,
      };
    }

    return {
      key: definition.key,
      title: definition.title,
      status: 'ready' as DiagnosticStatus,
      statusLabel: getReadyLabel(definition.supportsAuto),
      detail: definition.automationMode === 'event'
        ? 'Teknisk klar. Matchende brugere beregnes først i den konkrete push-rute, men dry run fandt ingen opsætningsfejl.'
        : 'Klar. Dry run fandt env, database, route og aktive subscriptions.',
      route: ADMIN_PUSH_ROUTES[definition.key],
      enabled: config.is_enabled,
      autoSendEnabled: config.auto_send_enabled,
      checks,
    };
  });

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    dryRun: true,
    env,
    missingEnv,
    metrics: {
      activeSubscriptions,
      failingSubscriptions,
      configuredNotifications: configRows.length,
    },
    summary: buildSummary(diagnostics),
    diagnostics,
  });
}

function buildSummary(diagnostics: Array<{ status: DiagnosticStatus }>) {
  return diagnostics.reduce((summary, item) => {
    summary.total += 1;
    summary[item.status] += 1;
    return summary;
  }, {
    total: 0,
    ready: 0,
    warning: 0,
    disabled: 0,
    no_match: 0,
    missing_env: 0,
    database_error: 0,
  } satisfies Record<DiagnosticStatus | 'total', number>);
}
