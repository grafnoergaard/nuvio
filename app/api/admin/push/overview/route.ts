import { NextRequest, NextResponse } from 'next/server';

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
    notifications: [
      {
        key: 'test_all_users',
        title: 'Test push',
        description: 'Sender en enkel testbesked til alle aktive push-modtagere.',
        audience: 'Alle aktive brugere',
        status: 'Klar',
        enabled: true,
      },
      {
        key: 'weekly_budget_reminder',
        title: 'Ugebudget-påmindelse',
        description: 'Forslag: mind brugeren om status midt i ugen.',
        audience: 'Brugere med aktiv Kuvert',
        status: 'Forslag',
        enabled: false,
      },
      {
        key: 'streak_risk',
        title: 'Streak i fare',
        description: 'Forslag: send besked når streak er ved at ryge.',
        audience: 'Brugere tæt på budgetgrænse',
        status: 'Forslag',
        enabled: false,
      },
      {
        key: 'month_close',
        title: 'Måneden lukker snart',
        description: 'Forslag: mind om de sidste dage i den aktuelle Kuvert.',
        audience: 'Aktive brugere sidst på måneden',
        status: 'Forslag',
        enabled: false,
      },
    ],
  });
}
