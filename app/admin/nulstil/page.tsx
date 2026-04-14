'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import DataResetWizard from '@/components/data-reset-wizard';
import { RotateCcw, Loader as Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const USER_LIST_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-user-list`;

interface AdminUser {
  id: string;
  email: string;
}

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

export default function NulstilPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const headers = await getAuthHeader();
        const res = await fetch(USER_LIST_URL, { headers });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setUsers(
          (json.users ?? []).map((u: any) => ({ id: u.id, email: u.email }))
        );
      } catch {
        toast.error('Kunne ikke hente brugerliste');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="mb-2">
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <RotateCcw className="h-8 w-8 text-red-500" />
            Nulstil data
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Slet udvalgte data for en specifik bruger. Kan ikke fortrydes.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DataResetWizard users={users} />
        )}
      </div>
    </div>
  );
}
