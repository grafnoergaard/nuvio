import { createClient } from '@supabase/supabase-js';

import { supabaseAnonKey, supabaseUrl } from './supabase';

export function createSupabaseRouteClient(authorization?: string | null) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: authorization
      ? {
          headers: {
            Authorization: authorization,
          },
        }
      : undefined,
  });
}

export function createSupabaseServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY mangler');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
