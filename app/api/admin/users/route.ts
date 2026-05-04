import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';

import { requireAdminUser } from '@/lib/admin-api-auth';
import { createSupabaseServiceClient } from '@/lib/supabase-server';

function mapAdminUser(user: User) {
  const appMetadata = user.app_metadata ?? {};

  return {
    id: user.id,
    email: user.email ?? '',
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at ?? null,
    is_admin: appMetadata.is_admin === true || appMetadata.role === 'admin',
  };
}

async function listAllUsers() {
  const supabase = createSupabaseServiceClient();
  const users: User[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const batch = data.users ?? [];
    users.push(...batch);

    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdminUser(request.headers.get('authorization'));
  if (admin.error) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const users = await listAllUsers();
    return NextResponse.json({ users: users.map(mapAdminUser) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kunne ikke hente brugere';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminUser(request.headers.get('authorization'));
  if (admin.error) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const { userId, isAdmin } = await request.json();
    if (!userId || typeof isAdmin !== 'boolean') {
      return NextResponse.json({ error: 'userId og isAdmin er påkrævet' }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: existing, error: existingError } = await supabase.auth.admin.getUserById(userId);
    if (existingError) throw existingError;
    if (!existing.user) {
      return NextResponse.json({ error: 'Bruger ikke fundet' }, { status: 404 });
    }

    const appMetadata = {
      ...(existing.user.app_metadata ?? {}),
      is_admin: isAdmin,
      role: isAdmin ? 'admin' : 'user',
    };

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: appMetadata,
    });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kunne ikke opdatere adgang';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdminUser(request.headers.get('authorization'));
  if (admin.error) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail og adgangskode er påkrævet' }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;

    return NextResponse.json({ user: data.user ? mapAdminUser(data.user) : null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kunne ikke oprette bruger';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
