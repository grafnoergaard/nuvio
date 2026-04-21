'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Bell, BellRing, Clock3, Rocket, Save, Send, Sparkles, Users, TriangleAlert, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import type { PushScheduleType } from '@/lib/push-notifications';

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
    messageTitle: string;
    messageBody: string;
    supportsAuto: boolean;
    supportedScheduleTypes: PushScheduleType[];
    autoSendEnabled: boolean;
    scheduleType: PushScheduleType;
    sendDayOfWeek: number | null;
    sendDayOfMonth: number | null;
    sendHour: number;
    sendMinute: number;
    timezone: string;
    lastSentAt: string | null;
    lastResult: string | null;
  }>;
};

type NotificationConfigState = {
  enabled: boolean;
  autoSendEnabled: boolean;
  messageTitle: string;
  messageBody: string;
  scheduleType: PushScheduleType;
  sendDayOfWeek: number | null;
  sendDayOfMonth: number | null;
  sendHour: number;
  sendMinute: number;
  timezone: string;
};

const WEEKDAY_OPTIONS = [
  { value: '0', label: 'Søndag' },
  { value: '1', label: 'Mandag' },
  { value: '2', label: 'Tirsdag' },
  { value: '3', label: 'Onsdag' },
  { value: '4', label: 'Torsdag' },
  { value: '5', label: 'Fredag' },
  { value: '6', label: 'Lørdag' },
];

export default function AdminPushPage() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [configs, setConfigs] = useState<Record<string, NotificationConfigState>>({});

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
      setConfigs(Object.fromEntries((data.notifications ?? []).map((notification: OverviewResponse['notifications'][number]) => [
        notification.key,
        {
          enabled: notification.enabled,
          autoSendEnabled: notification.autoSendEnabled,
          messageTitle: notification.messageTitle,
          messageBody: notification.messageBody,
          scheduleType: notification.scheduleType,
          sendDayOfWeek: notification.sendDayOfWeek,
          sendDayOfMonth: notification.sendDayOfMonth,
          sendHour: notification.sendHour,
          sendMinute: notification.sendMinute,
          timezone: notification.timezone,
        },
      ])));
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
    await sendPushAction('/api/admin/push/send-test', 'Test sendt');
  }

  async function sendWeeklyBudgetReminder() {
    await sendPushAction('/api/admin/push/send-weekly-reminder', 'Ugebudget-påmindelse sendt');
  }

  async function saveConfig(key: string) {
    const config = configs[key];
    if (!config) return;

    setSavingKey(key);
    try {
      const response = await fetch('/api/admin/push/config', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          key,
          enabled: config.enabled,
          autoSendEnabled: config.autoSendEnabled,
          messageTitle: config.messageTitle,
          messageBody: config.messageBody,
          scheduleType: config.scheduleType,
          sendDayOfWeek: config.sendDayOfWeek,
          sendDayOfMonth: config.sendDayOfMonth,
          sendHour: config.sendHour,
          sendMinute: config.sendMinute,
          timezone: config.timezone,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Kunne ikke gemme push-indstillinger');

      toast.success('Push-indstillinger gemt');
      loadOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kunne ikke gemme push-indstillinger');
    } finally {
      setSavingKey(null);
    }
  }

  async function sendPushAction(url: string, successLabel: string) {
    setSending(true);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Kunne ikke sende push');

      const result = data?.result;
      toast.success(
        `${successLabel}. ${result?.sent ?? 0} leveret, ${result?.failed ?? 0} fejlede.`
      );
      loadOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kunne ikke sende push');
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

  function updateConfig(key: string, updater: (current: NotificationConfigState) => NotificationConfigState) {
    setConfigs((current) => {
      const existing = current[key];
      if (!existing) return current;
      return {
        ...current,
        [key]: updater(existing),
      };
    });
  }

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
                  <div className="min-w-0 flex-1">
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

                    <div className="mt-4 rounded-2xl border border-border/50 bg-secondary/10 p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                            Push-titel
                          </p>
                          <Input
                            value={configs[notification.key]?.messageTitle ?? notification.messageTitle}
                            onChange={(event) => updateConfig(notification.key, (current) => ({
                              ...current,
                              messageTitle: event.target.value,
                            }))}
                            className="h-10 rounded-xl bg-white/80"
                            placeholder="Skriv titel"
                          />
                        </div>

                        <div className="rounded-xl border border-border/50 bg-white/70 px-3 py-2">
                          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                            Preview
                          </p>
                          <p className="mt-2 text-sm font-semibold text-foreground">
                            {configs[notification.key]?.messageTitle || notification.messageTitle}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {configs[notification.key]?.messageBody || notification.messageBody}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                          Push-tekst
                        </p>
                        <Textarea
                          value={configs[notification.key]?.messageBody ?? notification.messageBody}
                          onChange={(event) => updateConfig(notification.key, (current) => ({
                            ...current,
                            messageBody: event.target.value,
                          }))}
                          className="min-h-[104px] rounded-xl bg-white/80"
                          placeholder="Skriv teksten der skal stå i notifikationen"
                        />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">Aktiv</p>
                            <p className="text-xs text-muted-foreground">Pushen er synlig og klar til brug.</p>
                          </div>
                          <Switch
                            checked={configs[notification.key]?.enabled ?? notification.enabled}
                            onCheckedChange={(checked) => updateConfig(notification.key, (current) => ({ ...current, enabled: checked }))}
                          />
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">Automatisk</p>
                            <p className="text-xs text-muted-foreground">
                              {notification.supportsAuto
                                ? 'Sendes automatisk efter det valgte tidspunkt.'
                                : 'Test-push sendes kun manuelt.'}
                            </p>
                          </div>
                          <Switch
                            checked={configs[notification.key]?.autoSendEnabled ?? notification.autoSendEnabled}
                            disabled={!notification.supportsAuto}
                            onCheckedChange={(checked) => updateConfig(notification.key, (current) => ({ ...current, autoSendEnabled: checked }))}
                          />
                        </div>
                      </div>

                      {notification.supportsAuto ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_120px_120px]">
                          {configs[notification.key]?.scheduleType === 'monthly' ? (
                            <div>
                              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                                Sendes den
                              </p>
                              <Select
                                value={String(configs[notification.key]?.sendDayOfMonth ?? notification.sendDayOfMonth ?? 25)}
                                onValueChange={(value) => updateConfig(notification.key, (current) => ({
                                  ...current,
                                  sendDayOfMonth: Number(value),
                                }))}
                              >
                                <SelectTrigger className="h-10 rounded-xl bg-white/80">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                                    <SelectItem key={day} value={String(day)}>
                                      D. {day}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <div>
                              <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                                Sendes den
                              </p>
                              <Select
                                value={String(configs[notification.key]?.sendDayOfWeek ?? notification.sendDayOfWeek ?? 1)}
                                onValueChange={(value) => updateConfig(notification.key, (current) => ({
                                  ...current,
                                  sendDayOfWeek: Number(value),
                                }))}
                              >
                                <SelectTrigger className="h-10 rounded-xl bg-white/80">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {WEEKDAY_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <NumberField
                            label="Time"
                            min={0}
                            max={23}
                            value={configs[notification.key]?.sendHour ?? notification.sendHour}
                            onChange={(value) => updateConfig(notification.key, (current) => ({ ...current, sendHour: value }))}
                          />

                          <NumberField
                            label="Minut"
                            min={0}
                            max={59}
                            value={configs[notification.key]?.sendMinute ?? notification.sendMinute}
                            onChange={(value) => updateConfig(notification.key, (current) => ({ ...current, sendMinute: value }))}
                          />
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Denne bruges kun manuelt, så du altid selv styrer hvornår testen går ud.
                        </p>
                      )}

                      {notification.lastSentAt && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" />
                          <span>Sidst sendt: {new Date(notification.lastSentAt).toLocaleString('da-DK')}</span>
                          {notification.lastResult ? <span>• {notification.lastResult}</span> : null}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {notification.key === 'test_all_users' ? (
                      <Button
                        className="shrink-0"
                        onClick={sendTestPush}
                        disabled={sending || loading}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send nu
                      </Button>
                    ) : notification.key === 'weekly_budget_reminder' ? (
                      <Button
                        className="shrink-0"
                        onClick={sendWeeklyBudgetReminder}
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

                    <Button
                      variant="outline"
                      className="shrink-0"
                      onClick={() => saveConfig(notification.key)}
                      disabled={savingKey === notification.key || loading}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Gem
                    </Button>
                  </div>
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
                <p>
                  Automatikken læser de gemte tider fra admin og kører via <span className="font-medium text-foreground">/api/push/cron</span>, så næste praktiske step efter UI er at koble den route til Vercel Cron eller en anden scheduler.
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
                <SuggestionRow title="Ugebudget-påmindelse" copy="Åbner et lille uge-flow med status og et nyttigt næste skridt." />
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

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
        {label}
      </p>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isFinite(next)) return;
          onChange(Math.max(min, Math.min(max, next)));
        }}
        className="h-10 w-full rounded-xl border border-border/60 bg-white/80 px-3 text-sm outline-none ring-0 focus:border-primary"
      />
    </div>
  );
}
