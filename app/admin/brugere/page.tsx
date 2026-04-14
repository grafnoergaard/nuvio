'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, RefreshCw, UserPlus, Eye, EyeOff, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('da-DK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-user-list`;
const BACKFILL_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-backfill-streaks`;

export default function BrugerePage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(FUNCTION_URL, { headers });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setUsers(json.users ?? []);
    } catch {
      toast.error('Kunne ikke hente brugere');
    } finally {
      setLoading(false);
    }
  }

  async function toggleAdmin(userId: string, newValue: boolean) {
    setToggling(userId);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId, isAdmin: newValue }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_admin: newValue } : u))
      );
      toast.success(newValue ? 'Backend-adgang givet' : 'Backend-adgang fjernet');
    } catch {
      toast.error('Kunne ikke opdatere adgang');
    } finally {
      setToggling(null);
    }
  }

  async function handleBackfillAll() {
    setBackfilling(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(BACKFILL_URL, { method: 'POST', headers });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const errorCount = (json.errors ?? []).length;
      const msg = `Backfill gennemført for ${json.usersProcessed} bruger(e)` + (errorCount > 0 ? ` — ${errorCount} fejl` : '');
      toast.success(msg);
      if (errorCount > 0) {
        console.error('Backfill errors:', json.errors);
        (json.errors as { userId: string; stage: string; error: string }[]).forEach((e) => {
          toast.error(`${e.userId.slice(0, 8)}: ${e.stage} — ${e.error}`);
        });
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Backfill fejlede');
    } finally {
      setBackfilling(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim() || !newPassword.trim()) {
      toast.error('Udfyld både e-mail og adgangskode');
      return;
    }
    setCreating(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(FUNCTION_URL, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ email: newEmail.trim(), password: newPassword }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success(`Bruger oprettet: ${json.user.email}`);
      setNewEmail('');
      setNewPassword('');
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message ?? 'Kunne ikke oprette bruger');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Brugere</h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Administrer brugere og backend-adgang
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadUsers} disabled={loading} className="mt-1">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Opdater
          </Button>
        </div>

        <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Opret ny bruger
            </CardTitle>
            <CardDescription>
              Opret en bruger direkte uden e-mailbekræftelse
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-email">E-mail</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder="bruger@eksempel.dk"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    disabled={creating}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">Adgangskode</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 6 tegn"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={creating}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <Button type="submit" disabled={creating} className="w-full sm:w-auto">
                <UserPlus className="h-4 w-4 mr-2" />
                {creating ? 'Opretter...' : 'Opret bruger'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Backfill scores
            </CardTitle>
            <CardDescription>
              Genberegn udgiftsscore og streak for alle brugere baseret på deres historik
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Kør dette hvis brugere mangler en score, eller hvis beregningslogikken er opdateret. Kun manglende måneder behandles — eksisterende scores overskrives ikke.
            </p>
            <Button onClick={handleBackfillAll} disabled={backfilling} variant="outline">
              <Zap className={`h-4 w-4 mr-2 ${backfilling ? 'animate-pulse' : ''}`} />
              {backfilling ? 'Beregner...' : 'Kør backfill for alle brugere'}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 rounded-3xl overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Registrerede brugere
              {!loading && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">({users.length})</span>
              )}
            </CardTitle>
            <CardDescription>
              Slå backend-adgang til eller fra for hver bruger
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 py-3">
                    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-6 w-10 bg-muted rounded-full animate-pulse" />
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Ingen brugere fundet</p>
            ) : (
              <div className="divide-y divide-border">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center gap-4 py-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary uppercase">
                        {user.email?.[0] ?? '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Oprettet {formatDate(user.created_at)}
                        {user.last_sign_in_at && (
                          <span className="ml-2">· Sidst aktiv {formatDate(user.last_sign_in_at)}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className={`text-xs font-medium ${user.is_admin ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                        {user.is_admin ? 'Backend' : 'Normal'}
                      </span>
                      <Switch
                        checked={user.is_admin}
                        disabled={toggling === user.id}
                        onCheckedChange={(val) => toggleAdmin(user.id, val)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
