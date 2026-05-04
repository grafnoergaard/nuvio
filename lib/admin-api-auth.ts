import { createSupabaseRouteClient } from '@/lib/supabase-server';

export function isAdminUser(user: { app_metadata?: Record<string, unknown> | null } | null) {
  return user?.app_metadata?.is_admin === true || user?.app_metadata?.role === 'admin';
}

export async function requireAdminUser(authorization: string | null) {
  if (!authorization) {
    return { user: null, error: 'Mangler login', status: 401 };
  }

  const routeClient = createSupabaseRouteClient(authorization);
  const { data: { user }, error } = await routeClient.auth.getUser();

  if (error || !user) {
    return { user: null, error: 'Ugyldigt login', status: 401 };
  }

  if (!isAdminUser(user)) {
    return { user: null, error: 'Kun admin har adgang', status: 403 };
  }

  return { user, error: null, status: 200 };
}
