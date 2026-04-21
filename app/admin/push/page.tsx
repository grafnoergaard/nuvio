'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Bell, BellRing, Rocket, Send, Sparkles, Users, TriangleAlert, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';

type OverviewResponse = {
  ok: boolean;
  metrics: {
    totalSubscriptions: number;
    activeSubscriptions: number;
    seenLast7Days: number;
    failingSubscriptions: number;
  };
  notifications: Array<{
    key: string;
    title: string;
    description: string;
    audience: string;
    status: string;
    enabled: boolean;
  }>;
};

export default function AdminPushPage() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);

  const headers = useMemo(() => ({
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  }), [session?.access_token]);

  async function loadOverview() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/push/overview', {
        headers,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Kunne ikke hente push-overblik');
      setOverview(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kunne ikke hente push-overblik');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.access_token) return;
    loadOverview();
  }, [session?.access_token]);

  async function sendTestPush() {
    setSending(true);
    try {
      const response = await fetch('/api/admin/push/send-test', {
        method: 'POST',
        headers,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Kunne ikke sende test push');

      const result = data?.result;
      toast.success(
        `Test sendt. ${result?.sent ?? 0} leveret, ${result?.failed ?? 0} fejlede.`
      );
      loadOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kunne ikke sende test push');
    } finally {
      setSending(false);
    }
  }

  const metrics = overview?.metrics ?? {
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    seenLast7Days: 0,
    failingSubscriptions: 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-8 px-4 md:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
              Admin
            </p>
            <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-3">
              <BellRing className="h-7 w-7 text-primary" />
              Push
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
              Her får du overblik over Kuverts push-lag og kan sende den første testbesked til alle aktive modtagere.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadOverview} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Opdatér
            </Button>
            <Button onClick={sendTestPush} disabled={sending || loading}>
              <Send className="mr-2 h-4 w-4" />
              Send test til alle
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Bell className="h-4 w-4" />}
            label="Totale subscriptions"
            value={metrics.totalSubscriptions}
            tone="text-foreground"
          />
          <MetricCard
            icon={<Users className="h-4 w-4" />}
            label="Aktive modtagere"
            value={metrics.activeSubscriptions}
            tone="text-emerald-700"
          />
          <MetricCard
            icon={<Rocket className="h-4 w-4" />}
            label="Set sidste 7 dage"
            value={metrics.seenLast7Days}
            tone="text-sky-700"
          />
          <MetricCard
            icon={<TriangleAlert className="h-4 w-4" />}
            label="Fejlende subscriptions"
            value={metrics.failingSubscriptions}
            tone="text-amber-700"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-4 w-4 text-primary" />
                Push-notifikationer
              </CardTitle>
              <CardDescription>
                Første version: én live test og et tydeligt backlog over de næste beskeder, vi kan bygge.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(overview?.notifications ?? []).map((notification) => (
                <div
                  key={notification.key}
                  className="rounded-2xl border border-border/60 bg-card px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                      <Badge variant="outline" className="rounded-full">
                        {notification.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {notification.description}
                    </p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
                      Målgruppe: {notification.audience}
                    </p>
                  </div>
                  {notification.key === 'test_all_users' ? (
                    <Button
                      className="shrink-0"
                      onClick={sendTestPush}
                      disabled={sending || loading}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Send nu
                    </Button>
                  ) : (
                    <Button variant="outline" className="shrink-0" disabled>
                      Kommer snart
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Første setup
                </CardTitle>
                <CardDescription>
                  Sådan giver den her første version mening.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                <p>
                  Vi starter med en ren <span className="font-medium text-foreground">testbesked til alle aktive enheder</span>, så du kan se tone, ikon og levering i virkeligheden.
                </p>
                <p>
                  Når den fungerer stabilt, er næste naturlige lag at splitte push op i <span className="font-medium text-foreground">test</span>, <span className="font-medium text-foreground">påmindelser</span> og <span className="font-medium text-foreground">advarsler</span>.
                </p>
                <p>
                  Det giver os et klart skel mellem teknisk test og rigtige brugerbeskeder.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-4 w-4 text-primary" />
                  Mine forslag
                </CardTitle>
                <CardDescription>
                  De næste push-typer jeg synes giver mest værdi.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <SuggestionRow title="Midt-uge påmindelse" copy="Du har stadig plads i din Kuvert denne uge." />
                <SuggestionRow title="Streak i fare" copy="Du er tæt på at bryde din uge-streak." />
                <SuggestionRow title="Måneden lukker snart" copy="Nu er det tid til at lande blødt i slutningen af måneden." />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={`mt-2 text-3xl font-semibold tabular-nums ${tone}`}>{value}</p>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SuggestionRow({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-2xl border border-border/60 px-4 py-3">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
    </div>
  );
}
