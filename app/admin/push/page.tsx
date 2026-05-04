'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, Bell, BellRing, Clock3, Rocket, Save, Send, Users, TriangleAlert, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import type { PushAutomationMode, PushScheduleType, StreakRiskTriggerCondition } from '@/lib/push-notifications';

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
    previewUrl: string | null;
    enabled: boolean;
    messageTitle: string;
    messageBody: string;
    supportsAuto: boolean;
    automationMode: PushAutomationMode;
    supportedScheduleTypes: PushScheduleType[];
    autoSendEnabled: boolean;
    scheduleType: PushScheduleType;
    sendDayOfWeek: number | null;
    sendDayOfMonth: number | null;
    sendHour: number;
    sendMinute: number;
    timezone: string;
    triggerCondition: StreakRiskTriggerCondition;
    deliveryWindowStartHour: number;
    deliveryWindowEndHour: number;
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
  triggerCondition: StreakRiskTriggerCondition;
  deliveryWindowStartHour: number;
  deliveryWindowEndHour: number;
};

type DiagnosticStatus =
  | 'ready'
  | 'warning'
  | 'disabled'
  | 'no_match'
  | 'missing_env'
  | 'database_error';

type DiagnosticsResponse = {
  ok: boolean;
  generatedAt: string;
  dryRun: boolean;
  env: Record<string, boolean>;
  missingEnv: string[];
  metrics: {
    activeSubscriptions: number;
    failingSubscriptions: number;
    configuredNotifications: number;
  };
  summary: Record<DiagnosticStatus | 'total', number>;
  diagnostics: Array<{
    key: string;
    title: string;
    status: DiagnosticStatus;
    statusLabel: string;
    detail: string;
    route: string;
    enabled: boolean;
    autoSendEnabled: boolean;
    checks: string[];
  }>;
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

const GLOBAL_CRON_COPY = 'Automatikken kører én gang om dagen via Vercel Cron omkring kl. 11 dansk tid (09:00 UTC på Hobby). De aktive auto-pushes bliver vurderet i det daglige sweep.';

export default function AdminPushPage() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResponse | null>(null);
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
          triggerCondition: notification.triggerCondition,
          deliveryWindowStartHour: notification.deliveryWindowStartHour,
          deliveryWindowEndHour: notification.deliveryWindowEndHour,
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

  async function runDiagnostics() {
    setDiagnosing(true);
    try {
      const response = await fetch('/api/admin/push/diagnostics', {
        headers,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Kunne ikke køre push-diagnose');

      setDiagnostics(data);
      toast.success(
        `Diagnose færdig: ${data.summary?.ready ?? 0} klar, ${data.summary?.warning ?? 0} skal tjekkes.`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kunne ikke køre push-diagnose');
    } finally {
      setDiagnosing(false);
    }
  }

  async function sendWeeklyBudgetReminder() {
    await sendPushAction('/api/admin/push/send-weekly-reminder', 'Ugebudget-påmindelse sendt');
  }

  async function sendWeekBudgetSetup() {
    await sendPushAction('/api/admin/push/send-week-budget-setup', 'Rådighedsbeløb-påmindelse sendt');
  }

  async function sendWeekTransition() {
    await sendPushAction('/api/admin/push/send-week-transition', 'Ugeovergang sendt');
  }

  async function sendFlowSavings() {
    await sendPushAction('/api/admin/push/send-flow-savings', 'Sparet-flow sendt');
  }

  async function sendWeeklyBudgetLow() {
    await sendPushAction('/api/admin/push/send-weekly-budget-low', 'Lavt ugebudget sendt');
  }

  async function sendStreakRisk() {
    await sendPushAction('/api/admin/push/send-streak-risk', 'Streak i fare sendt');
  }

  async function sendMonthClose() {
    await sendPushAction('/api/admin/push/send-month-close', 'Månedsluk-påmindelse sendt');
  }

  async function sendScoreDrop() {
    await sendPushAction('/api/admin/push/send-score-drop', 'Score-fald-påmindelse sendt');
  }

  async function sendScoreStrong() {
    await sendPushAction('/api/admin/push/send-score-strong', 'Positiv score-påmindelse sendt');
  }

  async function sendGoodGrip() {
    await sendPushAction('/api/admin/push/send-good-grip', 'Godt greb-påmindelse sendt');
  }

  async function sendHonestEntries() {
    await sendPushAction('/api/admin/push/send-honest-entries', 'Ærlige poster-påmindelse sendt');
  }

  async function sendSingleAccountMethod() {
    await sendPushAction('/api/admin/push/send-single-account-method', 'Én konto-påmindelse sendt');
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
          triggerCondition: config.triggerCondition,
          deliveryWindowStartHour: config.deliveryWindowStartHour,
          deliveryWindowEndHour: config.deliveryWindowEndHour,
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

  function previewNotificationFlow(previewUrl: string | null) {
    if (!previewUrl) {
      toast.error('Denne push har ikke et flow at previewe endnu');
      return;
    }

    window.open(previewUrl, '_blank', 'noopener,noreferrer');
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
      <div className="mx-auto max-w-6xl space-y-6">
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
            <Button variant="outline" onClick={runDiagnostics} disabled={diagnosing || loading}>
              <Activity className={`mr-2 h-4 w-4 ${diagnosing ? 'animate-pulse' : ''}`} />
              Diagnose
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

        <Card className="rounded-2xl border-border/70 bg-card">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Clock3 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      Global styring
                    </p>
                    <CardTitle className="mt-1 text-base">Daglig automatik</CardTitle>
                  </div>
                </div>
                <CardDescription className="max-w-3xl text-sm leading-relaxed">
                  {GLOBAL_CRON_COPY}
                </CardDescription>
              </div>
              <Badge variant="outline" className="rounded-full self-start px-3 py-1 text-xs font-medium">
                Vercel Hobby
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 pt-0 md:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-secondary/10 px-4 py-3">
              <p className="text-sm font-medium text-foreground">Globalt</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Ét dagligt sweep via <span className="font-medium text-foreground">/api/push/cron</span>. Klokkeslættet styres i Vercel, ikke pr. push.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-secondary/10 px-4 py-3">
              <p className="text-sm font-medium text-foreground">Pr. push</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Her styrer du stadig <span className="font-medium text-foreground">aktiv</span>, <span className="font-medium text-foreground">automatisk</span> og den konkrete dag eller trigger.
              </p>
            </div>
          </CardContent>
        </Card>

        {diagnostics ? (
          <Card className="rounded-2xl border-border/70 bg-card">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Push-diagnose
                  </CardTitle>
                  <CardDescription className="mt-2">
                    Dry run uden afsendelse. Tjekker env, database, subscriptions, configs og admin-ruter.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800 hover:bg-emerald-100">
                    {diagnostics.summary.ready} klar
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {diagnostics.summary.warning} tjek
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {diagnostics.metrics.activeSubscriptions} aktive modtagere
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {diagnostics.missingEnv.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">Miljøvariabler mangler</p>
                  <p className="mt-1">{diagnostics.missingEnv.join(', ')}</p>
                </div>
              ) : null}

              <div className="grid gap-3">
                {diagnostics.diagnostics.map((item) => (
                  <div key={item.key} className="rounded-2xl border border-border/60 bg-secondary/10 px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{item.title}</p>
                          <DiagnosticBadge status={item.status} label={item.statusLabel} />
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {item.detail}
                        </p>
                        <p className="mt-2 text-xs font-medium text-muted-foreground">
                          {item.route}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2 text-xs">
                        <Badge variant="outline" className="rounded-full">
                          {item.enabled ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          {item.autoSendEnabled ? 'Auto' : 'Manuel'}
                        </Badge>
                      </div>
                    </div>
                    {item.checks.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.checks.map((check) => (
                          <span
                            key={check}
                            className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] text-muted-foreground"
                          >
                            {check}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-4 w-4 text-primary" />
                Push-notifikationer
              </CardTitle>
              <CardDescription>
                Redigér tekster, automatik, diagnose og flow-preview for hver push.
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
                                ? notification.automationMode === 'event'
                                  ? 'Tjekkes løbende og sendes når rytmen faktisk er i fare.'
                                  : 'Sendes automatisk efter det valgte tidspunkt.'
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
                        notification.automationMode === 'event' ? (
                          <div className="mt-3 space-y-3">
                            <div className="grid gap-3">
                              {notification.key === 'streak_risk' || notification.key === 'weekly_budget_low' ? (
                                <div>
                                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                                    Trigger når
                                  </p>
                                  <Select
                                    value={configs[notification.key]?.triggerCondition ?? notification.triggerCondition}
                                    onValueChange={(value) => updateConfig(notification.key, (current) => ({
                                      ...current,
                                      triggerCondition: value as StreakRiskTriggerCondition,
                                    }))}
                                  >
                                    <SelectTrigger className="h-10 rounded-xl bg-white/80">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="both">
                                        {notification.key === 'weekly_budget_low'
                                          ? 'Lavt eller brugt op'
                                          : 'Tæt på grænsen eller over budget'}
                                      </SelectItem>
                                      <SelectItem value="close">
                                        {notification.key === 'weekly_budget_low'
                                          ? 'Kun lavt'
                                          : 'Kun tæt på grænsen'}
                                      </SelectItem>
                                      <SelectItem value="over">
                                        {notification.key === 'weekly_budget_low'
                                          ? 'Kun brugt op'
                                          : 'Kun over budget'}
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : notification.key === 'week_transition' ? (
                                <div className="rounded-xl bg-white/80 px-3 py-2">
                                  <p className="text-sm font-medium text-foreground">Trigger</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Sendes når sidste uge er klar til gennemgang, og brugeren endnu ikke har åbnet ugeflowet.
                                  </p>
                                </div>
                              ) : notification.key === 'flow_savings' ? (
                                <div className="rounded-xl bg-white/80 px-3 py-2">
                                  <p className="text-sm font-medium text-foreground">Trigger</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Sendes når en afsluttet uge har overskud, ugeflowet er gennemgået, og beløbet endnu ikke er flyttet til Sparet.
                                  </p>
                                </div>
                              ) : notification.key === 'score_drop' ? (
                                <div className="rounded-xl bg-white/80 px-3 py-2">
                                  <p className="text-sm font-medium text-foreground">Trigger</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Sendes når månedsscoren falder ind i en gul eller rød zone. Kan sende igen, hvis den bliver tydeligt værre.
                                  </p>
                                </div>
                              ) : notification.key === 'score_strong' ? (
                                <div className="rounded-xl bg-white/80 px-3 py-2">
                                  <p className="text-sm font-medium text-foreground">Trigger</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Sendes når månedsscoren står stærkt. Maks én gang pr. måned, så den føles som en varm forstærkning og ikke støj.
                                  </p>
                                </div>
                              ) : notification.key === 'good_grip' ? (
                                <div className="rounded-xl bg-white/80 px-3 py-2">
                                  <p className="text-sm font-medium text-foreground">Trigger</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Sendes når brugeren står et sundt sted i måneden. Den er tænkt som en rolig nudge, før noget begynder at skride.
                                  </p>
                                </div>
                              ) : (
                                <div className="rounded-xl bg-white/80 px-3 py-2">
                                  <p className="text-sm font-medium text-foreground">Trigger</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Sendes på en semi-tilfældig dag i måneden til brugere, hvor påmindelsen giver mening. Den er bygget til at føles som en rolig, nyttig nudge - ikke en alarm.
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="rounded-xl border border-border/50 bg-secondary/10 px-3 py-2">
                              <p className="text-sm font-medium text-foreground">Daglig vurdering</p>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                Denne push vurderes i det daglige cron-run omkring kl. 11 dansk tid og sendes kun, hvis triggeren matcher den dag.
                                {' '}
                                {notification.key === 'streak_risk'
                                  ? 'Sendes højst én gang pr. uge. Hvis situationen forværres fra tæt på grænsen til over budget, må den gerne sende igen.'
                                  : notification.key === 'week_transition'
                                    ? 'Sendes højst én gang pr. afsluttet uge og kun hvis ugeflowet stadig venter på brugeren.'
                                  : notification.key === 'flow_savings'
                                    ? 'Sendes højst én gang pr. afsluttet uge og kun når der er et ubehandlet overskud til Sparet.'
                                  : notification.key === 'weekly_budget_low'
                                    ? 'Sendes højst én gang pr. uge. Hvis ugebudgettet går fra lavt til brugt op, må den gerne sende igen.'
                                    : notification.key === 'score_drop'
                                      ? 'Sendes højst én gang pr. måned. Hvis scoren falder fra gul til rød zone, må den gerne sende igen.'
                                      : notification.key === 'score_strong'
                                        ? 'Sendes højst én gang pr. måned, når scoren står stærkt.'
                                        : notification.key === 'good_grip'
                                          ? 'Sendes højst én gang pr. måned, når brugeren har et sundt og stabilt greb om måneden.'
                                          : 'Sendes højst cirka én gang hver anden til tredje uge pr. bruger.'}
                              </p>
                            </div>
                          </div>
                        ) : (
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
                          </div>
                        )
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
                    {notification.previewUrl ? (
                      <Button
                        variant="outline"
                        className="shrink-0"
                        onClick={() => previewNotificationFlow(notification.previewUrl)}
                      >
                        Preview flow
                      </Button>
                    ) : null}

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
                    ) : notification.key === 'week_budget_setup' ? (
                      <Button
                        className="shrink-0"
                        onClick={sendWeekBudgetSetup}
                        disabled={sending || loading}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send nu
                      </Button>
                    ) : notification.key === 'week_transition' ? (
                      <Button
                        className="shrink-0"
                        onClick={sendWeekTransition}
                        disabled={sending || loading}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send nu
                      </Button>
                    ) : notification.key === 'flow_savings' ? (
                      <Button
                        className="shrink-0"
                        onClick={sendFlowSavings}
                        disabled={sending || loading}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send nu
                      </Button>
                    ) : notification.key === 'weekly_budget_low' ? (
                      <Button
                        className="shrink-0"
                        onClick={sendWeeklyBudgetLow}
                        disabled={sending || loading}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send nu
                      </Button>
                    ) : notification.key === 'streak_risk' ? (
                      <Button
                        className="shrink-0"
                        onClick={sendStreakRisk}
                        disabled={sending || loading}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send nu
                      </Button>
                    ) : notification.key === 'month_close' ? (
                      <Button
                        className="shrink-0"
                        onClick={sendMonthClose}
                        disabled={sending || loading}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send nu
                      </Button>
                    ) : notification.key === 'score_drop' ? (
                      <Button
                        className="shrink-0"
                        onClick={sendScoreDrop}
                        disabled={sending || loading}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send nu
                      </Button>
                    ) : notification.key === 'score_strong' ? (
                      <Button
                        className="shrink-0"
                        onClick={sendScoreStrong}
                        disabled={sending || loading}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send nu
                      </Button>
                    ) : notification.key === 'good_grip' ? (
                      <Button
                        className="shrink-0"
                        onClick={sendGoodGrip}
                        disabled={sending || loading}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send nu
                      </Button>
                    ) : notification.key === 'honest_entries' ? (
                      <Button
                        className="shrink-0"
                        onClick={sendHonestEntries}
                        disabled={sending || loading}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send nu
                      </Button>
                    ) : notification.key === 'single_account_method' ? (
                      <Button
                        className="shrink-0"
                        onClick={sendSingleAccountMethod}
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

function DiagnosticBadge({ status, label }: { status: DiagnosticStatus; label: string }) {
  const className = {
    ready: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    disabled: 'border-slate-200 bg-slate-50 text-slate-600',
    no_match: 'border-sky-200 bg-sky-50 text-sky-800',
    missing_env: 'border-red-200 bg-red-50 text-red-800',
    database_error: 'border-red-200 bg-red-50 text-red-800',
  }[status];

  return (
    <Badge variant="outline" className={`rounded-full ${className}`}>
      {label}
    </Badge>
  );
}
