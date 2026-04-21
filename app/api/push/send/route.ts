import { NextRequest, NextResponse } from 'next/server';
import webpush, { WebPushError } from 'web-push';

import { createSupabaseServiceClient } from '@/lib/supabase-server';

type PushSendBody = {
  title?: string;
  body?: string;
  url?: string;
  userId?: string;
  userIds?: string[];
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
};

function isAuthorized(request: NextRequest) {
  const expectedSecret = process.env.KUVERT_PUSH_SECRET || process.env.CRON_SECRET;

  if (!expectedSecret) return false;

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const headerSecret = request.headers.get('x-kuvert-push-secret');

  return bearer === expectedSecret || headerSecret === expectedSecret;
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:grafnoergaard@gmail.com';

  if (!publicKey || !privateKey) {
    throw new Error('VAPID keys mangler');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 });
  }

  try {
    configureWebPush();
  } catch {
    return NextResponse.json({ error: 'Push er ikke konfigureret' }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as PushSendBody;
  const payload = JSON.stringify({
    title: body.title || 'Kuvert',
    body: body.body || 'Husk at tjekke din Kuvert i dag.',
    url: body.url || '/',
  });

  let supabase: ReturnType<typeof createSupabaseServiceClient>;

  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return NextResponse.json({ error: 'Supabase service role key mangler' }, { status: 500 });
  }

  let query = supabase
    .from('push_subscriptions')
    .select('id,user_id,endpoint,p256dh,auth,failure_count')
    .eq('is_active', true);

  if (body.userId) {
    query = query.eq('user_id', body.userId);
  }

  if (body.userIds?.length) {
    query = query.in('user_id', body.userIds);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Kunne ikke hente subscriptions' }, { status: 500 });
  }

  const subscriptions = (data ?? []) as PushSubscriptionRow[];
  let sent = 0;
  let failed = 0;
  let deactivated = 0;

  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      }, payload);

      sent += 1;
      await supabase
        .from('push_subscriptions')
        .update({
          last_sent_at: new Date().toISOString(),
          failure_count: 0,
          failed_at: null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', subscription.id);
    } catch (error) {
      failed += 1;

      const statusCode = error instanceof WebPushError ? error.statusCode : undefined;
      const shouldDeactivate = statusCode === 404 || statusCode === 410;

      if (shouldDeactivate) deactivated += 1;

      await supabase
        .from('push_subscriptions')
        .update({
          is_active: shouldDeactivate ? false : true,
          failure_count: subscription.failure_count + 1,
          failed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', subscription.id);
    }
  }));

  return NextResponse.json({
    ok: true,
    targeted: subscriptions.length,
    sent,
    failed,
    deactivated,
  });
}
