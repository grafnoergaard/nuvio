import { NextRequest, NextResponse } from 'next/server';

import { createSupabaseRouteClient } from '@/lib/supabase-server';

type PushSubscriptionBody = {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
};

function parseSubscription(body: PushSubscriptionBody) {
  if (
    typeof body.endpoint !== 'string' ||
    typeof body.keys?.p256dh !== 'string' ||
    typeof body.keys?.auth !== 'string'
  ) {
    return null;
  }

  return {
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
  };
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  if (!authorization) {
    return NextResponse.json({ error: 'Mangler login' }, { status: 401 });
  }

  const supabase = createSupabaseRouteClient(authorization);
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Ugyldigt login' }, { status: 401 });
  }

  const subscription = parseSubscription(await request.json());

  if (!subscription) {
    return NextResponse.json({ error: 'Ugyldig push subscription' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      user_agent: request.headers.get('user-agent'),
      is_active: true,
      failure_count: 0,
      last_seen_at: now,
      updated_at: now,
    } as any, { onConflict: 'endpoint' });

  if (error) {
    return NextResponse.json({ error: 'Kunne ikke gemme subscription' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const authorization = request.headers.get('authorization');

  if (!authorization) {
    return NextResponse.json({ error: 'Mangler login' }, { status: 401 });
  }

  const supabase = createSupabaseRouteClient(authorization);
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Ugyldigt login' }, { status: 401 });
  }

  const { endpoint } = await request.json();

  if (typeof endpoint !== 'string') {
    return NextResponse.json({ error: 'Mangler endpoint' }, { status: 400 });
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .update({ is_active: false, updated_at: new Date().toISOString() } as any)
    .eq('endpoint', endpoint)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: 'Kunne ikke slå subscription fra' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
