'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Eye, RotateCcw, Users, CheckCircle2, Clock, RefreshCw, Play, X } from 'lucide-react';
import { WhyWizard } from '@/components/why-wizard';

interface CommitmentRow {
  id: string;
  user_id: string;
  accepted_at: string;
  version: string;
  precision_mode: boolean;
  email?: string;
}

export default function AdminWhyPage() {
  const [commitments, setCommitments] = useState<CommitmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_precision_commitment')
        .select('*')
        .order('accepted_at', { ascending: false });
      if (error) throw error;
      setCommitments(data ?? []);

      const { count } = await supabase
        .from('user_precision_commitment')
        .select('*', { count: 'exact', head: true });
      setTotalUsers(count ?? 0);
    } catch (err) {
      console.error('loadData error:', err);
      toast.error('Kunne ikke hente data');
    } finally {
      setLoading(false);
    }
  }

  async function resetCommitment(userId: string) {
    setResetting(userId);
    try {
      const { error } = await supabase
        .from('user_precision_commitment')
        .delete()
        .eq('user_id', userId);
      if (error) throw error;
      toast.success('Wizard nulstillet — brugeren ser den igen ved næste login');
      await loadData();
    } catch (err) {
      console.error('reset error:', err);
      toast.error('Kunne ikke nulstille');
    } finally {
      setResetting(null);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('da-DK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (showPreview) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowPreview(false)}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-lg hover:bg-foreground/90 transition-colors"
        >
          <X className="h-4 w-4" />
          Luk preview
        </button>
        <WhyWizard onComplete={() => setShowPreview(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-8">
      <div className="max-w-3xl mx-auto space-y-6">

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Why Wizard</h1>
          <p className="text-sm text-muted-foreground">
            Nuvios Rådgiverløfte — test, preview og administrer brugernes precision commitment.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="rounded-3xl border shadow-sm">
            <CardContent className="pt-6 pb-5 px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary">
                  <CheckCircle2 className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{loading ? '—' : commitments.filter(c => c.precision_mode).length}</p>
                  <p className="text-xs text-muted-foreground">Aktiveret precision mode</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border shadow-sm">
            <CardContent className="pt-6 pb-5 px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary">
                  <Users className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{loading ? '—' : totalUsers ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Total accepter</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Live Preview
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Se wizarden præcis som brugerne oplever den
                </CardDescription>
              </div>
              <Button
                onClick={() => setShowPreview(true)}
                className="rounded-xl h-9 px-4 gap-2 text-sm"
              >
                <Play className="h-3.5 w-3.5" />
                Start preview
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-5 px-6">
            <div className="rounded-2xl border border-border bg-secondary/20 px-5 py-4 text-sm text-muted-foreground leading-relaxed">
              Klik &quot;Start preview&quot; for at se Nuvios Rådgiverløfte-wizard i fuld skærm.
              Wizard-gennemløbet gemmer ikke data — det er kun til test og review af tekster og flow.
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Brugere der har accepteret
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Nulstil for at trigge wizarden igen ved næste besøg
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className="rounded-xl h-8 px-3 gap-1.5 text-xs"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                Opdater
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-2 px-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 rounded-full border-2 border-foreground border-t-transparent animate-spin" />
              </div>
            ) : commitments.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                Ingen brugere har accepteret endnu.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {commitments.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-6 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono text-muted-foreground truncate">
                        {c.user_id}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 ${
                          c.precision_mode
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-secondary text-muted-foreground'
                        }`}>
                          {c.precision_mode ? (
                            <><CheckCircle2 className="h-3 w-3" /> Aktiv</>
                          ) : (
                            'Inaktiv'
                          )}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDate(c.accepted_at)}
                        </span>
                        <span className="text-xs text-muted-foreground/60">
                          {c.version}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resetCommitment(c.user_id)}
                      disabled={resetting === c.user_id}
                      className="ml-4 rounded-xl h-8 px-3 gap-1.5 text-xs shrink-0"
                    >
                      {resetting === c.user_id ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      Nulstil
                    </Button>
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
