'use client';

import { useState, useEffect } from 'react';
import { Flame, Crown, Sparkles, Star, Gauge, TriangleAlert as AlertTriangle, CalendarDays, ChevronRight, Settings2, X, Award, Play, RotateCcw, FlaskConical, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import MonthTransitionModal from '@/components/month-transition-modal';
import { WeekTransitionBottomSheet, WeekTransitionWizard } from '@/components/week-transition-wizard';
import type { MonthSummary, QuickExpenseStreak } from '@/lib/quick-expense-service';
import type { WeekSummaryData } from '@/lib/week-transition-service';

const DANISH_MONTHS = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
];

function formatDKK(value: number): string {
  return value.toLocaleString('da-DK', { style: 'currency', currency: 'DKK', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface PreviewConfig {
  streak: number;
  healthPct: number;
  overBudget: boolean;
  monthlyBudget: number;
  totalSpent: number;
  remainingDays: number;
}

interface ScenarioPreset {
  label: string;
  description: string;
  summary: MonthSummary;
  streak: QuickExpenseStreak | null;
  defaultBudget: number;
}

const now = new Date();
const curYear = now.getFullYear();
const curMonth = now.getMonth() + 1;
const prevDate = new Date(curYear, curMonth - 2, 1);
const prevYear = prevDate.getFullYear();
const prevMonth = prevDate.getMonth() + 1;

const BASE_STREAK: QuickExpenseStreak = {
  id: 'test-streak',
  user_id: 'test',
  current_streak: 0,
  longest_streak: 0,
  cumulative_score: 0,
  last_evaluated_year: prevYear,
  last_evaluated_month: prevMonth,
  updated_at: new Date().toISOString(),
};

const PRESETS: ScenarioPreset[] = [
  {
    label: 'Ingen historik',
    description: 'Første gang brugeren ser modalen — ingen tidligere data.',
    summary: { year: prevYear, month: prevMonth, totalSpent: 0, budgetAmount: 0, expenseCount: 0, wasOnBudget: false },
    streak: null,
    defaultBudget: 0,
  },
  {
    label: 'Indenfor budget',
    description: 'Brugeren holdt sig indenfor budget forrige måned.',
    summary: { year: prevYear, month: prevMonth, totalSpent: 3200, budgetAmount: 4000, expenseCount: 12, wasOnBudget: true },
    streak: { ...BASE_STREAK, current_streak: 1, longest_streak: 1 },
    defaultBudget: 4000,
  },
  {
    label: 'Over budget',
    description: 'Brugeren overskred sit budget forrige måned.',
    summary: { year: prevYear, month: prevMonth, totalSpent: 5100, budgetAmount: 4000, expenseCount: 18, wasOnBudget: false },
    streak: { ...BASE_STREAK, current_streak: 0, longest_streak: 3 },
    defaultBudget: 4000,
  },
  {
    label: 'Streak 3 måneder',
    description: 'Tre måneder i træk indenfor budget.',
    summary: { year: prevYear, month: prevMonth, totalSpent: 2800, budgetAmount: 4500, expenseCount: 9, wasOnBudget: true },
    streak: { ...BASE_STREAK, current_streak: 3, longest_streak: 3 },
    defaultBudget: 4500,
  },
  {
    label: 'Streak 6 måneder',
    description: 'Et halvt år indenfor budget — milepæl.',
    summary: { year: prevYear, month: prevMonth, totalSpent: 3750, budgetAmount: 5000, expenseCount: 21, wasOnBudget: true },
    streak: { ...BASE_STREAK, current_streak: 6, longest_streak: 6 },
    defaultBudget: 5000,
  },
  {
    label: 'Streak 12 måneder',
    description: 'Et helt år indenfor budget — rekord.',
    summary: { year: prevYear, month: prevMonth, totalSpent: 4100, budgetAmount: 5500, expenseCount: 28, wasOnBudget: true },
    streak: { ...BASE_STREAK, current_streak: 12, longest_streak: 12 },
    defaultBudget: 5500,
  },
  {
    label: 'Rekord slået',
    description: 'Brugeren har slået sin personlige rekord denne måned.',
    summary: { year: prevYear, month: prevMonth, totalSpent: 3000, budgetAmount: 4000, expenseCount: 15, wasOnBudget: true },
    streak: { ...BASE_STREAK, current_streak: 5, longest_streak: 4 },
    defaultBudget: 4000,
  },
  {
    label: 'Streak brudt',
    description: 'Streaken er netop brudt efter 4 gode måneder.',
    summary: { year: prevYear, month: prevMonth, totalSpent: 6200, budgetAmount: 4000, expenseCount: 24, wasOnBudget: false },
    streak: { ...BASE_STREAK, current_streak: 0, longest_streak: 4 },
    defaultBudget: 4000,
  },
];

function StreakPopup({ streak, onClose }: { streak: number; onClose: () => void }) {
  const isRecord = streak > 1;
  const tierColor = streak >= 12 ? 'from-amber-400 to-orange-500' : streak >= 6 ? 'from-orange-400 to-red-400' : 'from-orange-300 to-amber-400';
  const tierBg = streak >= 12 ? 'bg-amber-50 border-amber-200/60' : streak >= 6 ? 'bg-orange-50 border-orange-200/60' : 'bg-orange-50/70 border-orange-200/40';
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
        style={{ animation: 'slideUp 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        <div className={cn('px-6 pt-8 pb-6 text-center', tierBg)}>
          <div className={cn('w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center mx-auto mb-4', tierColor)}>
            {isRecord ? <Award className="h-8 w-8 text-white" /> : <Flame className="h-8 w-8 text-white" />}
          </div>
          <p className="text-2xl font-bold text-orange-900 mb-1">{streak} {streak === 1 ? 'måned' : 'måneder'} i træk</p>
          <p className="text-sm text-orange-700/70">{isRecord ? 'Du slår din personlige rekord!' : 'Hold kursen!'}</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground mb-1.5">Hvad er en streak?</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              En streak tæller det antal måneder i træk, du har holdt dig inden for dit rådighedsbeløb. Hver måned du afslutter uden at overskride budgettet, forlænges din streak med én.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground mb-1.5">Hvad sker der ved overskridelse?</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Hvis du overskrider budgettet i en måned, nulstilles streaken til nul. Din personlige rekord gemmes dog altid.
            </p>
          </div>
          <div className="rounded-xl bg-orange-50/80 border border-orange-100/60 px-4 py-3">
            <p className="text-xs font-semibold text-orange-800 mb-1">Tanken bag</p>
            <p className="text-xs text-orange-700/80 leading-relaxed">
              Konsistens slår perfektionisme. Det er ikke om at spare mest muligt — det handler om at opbygge en stabil vane med at leve inden for dine egne rammer, måned efter måned.
            </p>
          </div>
        </div>
        <div className="px-6 pb-6">
          <button onClick={onClose} className="w-full h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-all duration-200">
            Forstået
          </button>
        </div>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-orange-700/50 hover:text-orange-700 hover:bg-orange-100/60 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function BudgetStatusCardPreview({ cfg: config }: { cfg: PreviewConfig }) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthLabel = DANISH_MONTHS[currentMonth - 1];
  const [showStreakPopup, setShowStreakPopup] = useState(false);

  const { streak, healthPct, overBudget, monthlyBudget, totalSpent, remainingDays } = config;

  const remaining = monthlyBudget - totalSpent;
  const dailyAvailable = remainingDays > 0 && remaining > 0 ? remaining / remainingDays : 0;
  const usedPct = monthlyBudget > 0 ? Math.min((totalSpent / monthlyBudget) * 100, 100) : 0;

  const healthBarPct = Math.min(100, Math.max(4, healthPct));
  const healthBarColor = healthPct >= 60 ? 'from-emerald-400 to-teal-400' : healthPct >= 30 ? 'from-amber-400 to-orange-300' : 'from-red-400 to-rose-400';
  const healthGlow = healthPct >= 60 ? 'shadow-emerald-300/60' : healthPct >= 30 ? 'shadow-amber-300/60' : 'shadow-red-300/60';
  const progressColor = overBudget ? 'bg-red-500' : usedPct > 80 ? 'bg-amber-500' : 'bg-emerald-500';

  const statusState: 'over' | 'warn' | 'tempo' | 'kursen' | 'flow' =
    overBudget ? 'over'
    : healthPct < 30 ? 'warn'
    : healthPct >= 80 ? 'flow'
    : healthPct >= 60 ? 'tempo'
    : 'kursen';

  const statusMap = {
    over: {
      cardBg: 'bg-gradient-to-br from-red-50 via-rose-50/60 to-white border-red-200/60',
      iconBg: 'bg-red-100',
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
      badgeEl: <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold tracking-wide text-white bg-red-500">Over budget</span>,
      headline: 'Du har overskredet dit budget',
      headlineColor: 'text-red-700',
      amountColor: 'text-red-600',
      ringColor: 'ring-red-200',
    },
    warn: {
      cardBg: 'bg-gradient-to-br from-amber-50 via-orange-50/40 to-white border-amber-200/60',
      iconBg: 'bg-amber-100',
      icon: <Gauge className="h-4 w-4 text-amber-600" />,
      badgeEl: <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold tracking-wide text-white bg-amber-500">Stram op</span>,
      headline: 'Hold igen på forbruget',
      headlineColor: 'text-amber-800',
      amountColor: 'text-amber-700',
      ringColor: 'ring-amber-200',
    },
    kursen: {
      cardBg: 'bg-gradient-to-br from-emerald-50/80 via-teal-50/30 to-white border-emerald-200/50',
      iconBg: 'bg-emerald-100',
      icon: <Star className="h-4 w-4 text-emerald-600" />,
      badgeEl: <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold tracking-wide text-white bg-emerald-500">Hold kursen</span>,
      headline: 'Du er på rette spor',
      headlineColor: 'text-emerald-800',
      amountColor: 'text-emerald-700',
      ringColor: 'ring-emerald-200',
    },
    tempo: {
      cardBg: 'bg-gradient-to-br from-emerald-50/80 via-teal-50/30 to-white border-emerald-200/50',
      iconBg: 'bg-emerald-100',
      icon: <Sparkles className="h-4 w-4 text-emerald-600" />,
      badgeEl: <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold tracking-wide text-white bg-emerald-500">Godt tempo</span>,
      headline: 'Du klarer det fremragende',
      headlineColor: 'text-emerald-800',
      amountColor: 'text-emerald-700',
      ringColor: 'ring-emerald-200',
    },
    flow: {
      cardBg: 'bg-gradient-to-br from-slate-50 via-gray-50/80 to-white border-yellow-300/40',
      iconBg: 'bg-gradient-to-br from-yellow-400 to-amber-500',
      icon: <Crown className="h-4 w-4 text-white" />,
      badgeEl: (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tracking-wide bg-gradient-to-r from-slate-700 to-slate-800 border border-yellow-400/40 shadow-sm">
          <Crown className="h-2.5 w-2.5 text-yellow-400" />
          <span className="text-yellow-300">Nuvio Flow</span>
        </span>
      ),
      headline: 'Du er i Nuvio Flow',
      headlineColor: 'text-slate-800',
      amountColor: 'text-slate-700',
      ringColor: 'ring-yellow-300/60',
    },
  };

  const s = statusMap[statusState];

  return (
    <div className={cn('rounded-2xl border shadow-sm transition-all duration-500', s.cardBg)}>
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-2', s.iconBg, s.ringColor)}>
            {s.icon}
          </div>
          <div>
            <p className="text-label font-semibold uppercase tracking-widest text-muted-foreground/50 leading-none mb-0.5">
              {monthLabel} {currentYear}
            </p>
            {s.badgeEl}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:bg-black/5 transition-all duration-200">
            <Settings2 className="h-3.5 w-3.5" />
            Rådighedsbeløb
          </button>
          <button className="flex items-center gap-1 text-xs text-muted-foreground/60">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="px-5 pb-5 space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className={cn('text-xs font-medium leading-snug mb-1', s.headlineColor)}>{s.headline}</p>
            <p className={cn('text-3xl font-semibold tracking-tight tabular-nums leading-none', s.amountColor)}>
              {formatDKK(Math.abs(remaining))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {overBudget ? 'over budget' : 'tilbage af ' + formatDKK(monthlyBudget)}
            </p>
          </div>
          {!overBudget && (
            <div className="flex gap-2 shrink-0">
              <div className="rounded-xl bg-white/60 border border-black/5 px-3 py-2 text-center min-w-[56px]">
                <p className="text-xs font-medium text-muted-foreground/70 leading-snug mb-0.5">Dage tilbage</p>
                <p className="text-sm font-semibold tracking-tight text-foreground">{remainingDays}</p>
              </div>
              <div className={cn(
                'rounded-xl border px-3 py-2 text-center min-w-[56px]',
                (statusState === 'tempo' || statusState === 'kursen' || statusState === 'flow') ? 'bg-emerald-50/80 border-emerald-100/60' :
                statusState === 'warn' ? 'bg-amber-50/80 border-amber-100/60' :
                'bg-red-50/80 border-red-100/60'
              )}>
                <p className="text-xs font-medium text-muted-foreground/70 leading-snug mb-0.5">Per dag</p>
                <p className={cn('text-sm font-semibold tracking-tight', s.amountColor)}>
                  {dailyAvailable > 0 ? formatDKK(Math.round(dailyAvailable)) : '0 kr.'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground tracking-wide">Nuvio Flow Score</span>
            <div className="flex items-center gap-2">
              {streak > 0 && (
                <button
                  onClick={() => setShowStreakPopup(true)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/60 hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  <Flame className="h-3 w-3 text-amber-500" />
                  <span className="text-xs font-bold tabular-nums text-amber-700">{streak}</span>
                </button>
              )}
              {showStreakPopup && <StreakPopup streak={streak} onClose={() => setShowStreakPopup(false)} />}
              {!overBudget && (
                <span className={cn('text-xs font-bold tabular-nums', s.amountColor)}>{healthPct}</span>
              )}
            </div>
          </div>
          <div className="relative h-2 rounded-full bg-black/[0.06] overflow-visible">
            {!overBudget ? (
              <div
                className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out shadow-sm', cn('bg-gradient-to-r', healthBarColor), healthGlow)}
                style={{ width: `${healthBarPct}%` }}
              >
                <div
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md border-2 border-emerald-400"
                />
              </div>
            ) : (
              <div className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-500', progressColor)} style={{ width: `${usedPct}%` }} />
            )}
          </div>
          <p className="text-label text-muted-foreground/60 leading-snug">
            {overBudget
              ? `${formatDKK(totalSpent)} brugt af ${formatDKK(monthlyBudget)}`
              : `${formatDKK(totalSpent)} brugt · ${formatDKK(Math.round(dailyAvailable))} pr. dag`}
          </p>
        </div>

        <div className="-mx-5 -mb-5 border-t border-black/5">
          <button className="w-full flex items-center justify-between px-5 py-3 hover:bg-black/[0.02] transition-colors">
            <div className="flex items-center gap-2.5">
              <CalendarDays className="h-4 w-4 text-emerald-600 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-semibold text-foreground">Ugebudget</p>
                <p className="text-label text-muted-foreground leading-snug">{formatDKK(Math.round(monthlyBudget / 4))} denne uge</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface WeekScenarioPreset {
  label: string;
  description: string;
  summaryData: WeekSummaryData;
}

const nowForWeek = new Date();
const weekCurYear = nowForWeek.getFullYear();
const weekCurMonth = nowForWeek.getMonth() + 1;
const weekPrevDate = new Date(weekCurYear, weekCurMonth - 2, 1);
const weekPrevYear = weekPrevDate.getFullYear();
const weekPrevMonth = weekPrevDate.getMonth() + 1;

function makeWeekDates(year: number, month: number, weekNum: number) {
  const firstDay = new Date(year, month - 1, 1);
  const startOffset = (weekNum - 1) * 7;
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() + startOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

const WEEK_PRESETS: WeekScenarioPreset[] = [
  {
    label: 'Indenfor ugebudget',
    description: 'Brugeren har brugt under sit ugebudget — carry-over til næste uge.',
    summaryData: {
      year: weekPrevYear, month: weekPrevMonth, weekNumber: 2, isoWeekNumber: 14,
      weekStart: makeWeekDates(weekPrevYear, weekPrevMonth, 2).start,
      weekEnd: makeWeekDates(weekPrevYear, weekPrevMonth, 2).end,
      budgetAmount: 1000, totalSpent: 720, carryOver: 280,
      transactionCount: 5, nextWeekBudget: 1280, avgTransactionsPerWeek: 4.5,
    },
  },
  {
    label: 'Over ugebudget',
    description: 'Brugeren overskred ugebudgettet — negativt carry-over.',
    summaryData: {
      year: weekPrevYear, month: weekPrevMonth, weekNumber: 2, isoWeekNumber: 14,
      weekStart: makeWeekDates(weekPrevYear, weekPrevMonth, 2).start,
      weekEnd: makeWeekDates(weekPrevYear, weekPrevMonth, 2).end,
      budgetAmount: 1000, totalSpent: 1340, carryOver: -340,
      transactionCount: 9, nextWeekBudget: 660, avgTransactionsPerWeek: 6,
    },
  },
  {
    label: 'Præcis på budget',
    description: 'Brugeren ramte sit ugebudget næsten præcist.',
    summaryData: {
      year: weekPrevYear, month: weekPrevMonth, weekNumber: 1, isoWeekNumber: 13,
      weekStart: makeWeekDates(weekPrevYear, weekPrevMonth, 1).start,
      weekEnd: makeWeekDates(weekPrevYear, weekPrevMonth, 1).end,
      budgetAmount: 1000, totalSpent: 998, carryOver: 2,
      transactionCount: 7, nextWeekBudget: 1002, avgTransactionsPerWeek: 6,
    },
  },
  {
    label: 'Ingen udgifter',
    description: 'Brugeren registrerede ingen udgifter i ugen.',
    summaryData: {
      year: weekPrevYear, month: weekPrevMonth, weekNumber: 3, isoWeekNumber: 15,
      weekStart: makeWeekDates(weekPrevYear, weekPrevMonth, 3).start,
      weekEnd: makeWeekDates(weekPrevYear, weekPrevMonth, 3).end,
      budgetAmount: 1000, totalSpent: 0, carryOver: 1000,
      transactionCount: 0, nextWeekBudget: 2000, avgTransactionsPerWeek: null,
    },
  },
  {
    label: 'Stort overskud',
    description: 'Brugeren brugte meget lidt — stort carry-over.',
    summaryData: {
      year: weekPrevYear, month: weekPrevMonth, weekNumber: 2, isoWeekNumber: 14,
      weekStart: makeWeekDates(weekPrevYear, weekPrevMonth, 2).start,
      weekEnd: makeWeekDates(weekPrevYear, weekPrevMonth, 2).end,
      budgetAmount: 1500, totalSpent: 210, carryOver: 1290,
      transactionCount: 2, nextWeekBudget: 2790, avgTransactionsPerWeek: 5,
    },
  },
  {
    label: 'Kraftig overskridelse',
    description: 'Brugeren overskred sit budget markant.',
    summaryData: {
      year: weekPrevYear, month: weekPrevMonth, weekNumber: 4, isoWeekNumber: 16,
      weekStart: makeWeekDates(weekPrevYear, weekPrevMonth, 4).start,
      weekEnd: makeWeekDates(weekPrevYear, weekPrevMonth, 4).end,
      budgetAmount: 1000, totalSpent: 2850, carryOver: -1850,
      transactionCount: 14, nextWeekBudget: 0, avgTransactionsPerWeek: 8,
    },
  },
];

function WeekTransitionSection() {
  const [showModal, setShowModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [activePreset, setActivePreset] = useState<WeekScenarioPreset | null>(null);
  const [resetting, setResetting] = useState(false);
  const [accessToken, setAccessToken] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) setAccessToken(session.access_token);
    });
  }, []);

  function launchPreset(preset: WeekScenarioPreset) {
    setActivePreset(preset);
    setShowModal(true);
  }

  async function resetWeekTransitions() {
    setResetting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Ikke logget ind'); return; }

      const { error } = await supabase
        .from('week_transitions')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Alle ugeskifte-records er slettet — åbn Nuvio Flow for at se modalen igen.');
    } catch {
      toast.error('Kunne ikke nulstille ugeskifter');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Test: Ugeskifte-modal</h2>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Forhåndsvisning og test af WeekTransitionModal under forskellige brugerscenarier.
          Modalen vises normalt automatisk ved starten af en ny uge på Nuvio Flow.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            Nulstil ugeskifter
          </CardTitle>
          <CardDescription>
            Slet alle dine ugeskifte-records, så modalen vises igen næste gang du åbner Nuvio Flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            onClick={resetWeekTransitions}
            disabled={resetting}
            className="gap-2"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {resetting ? 'Nulstiller…' : 'Nulstil ugeskifter'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            Foruddefinerede scenarier
          </CardTitle>
          <CardDescription>
            Tryk på et scenarie for at se ugeskifte-modalen i den pågældende tilstand. Data er kun til preview — intet gemmes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {WEEK_PRESETS.map((preset, i) => {
            const d = preset.summaryData;
            const isOver = d.totalSpent > d.budgetAmount;
            return (
              <div key={i} className="flex items-center justify-between py-3 px-4 rounded-xl border border-border/60 hover:bg-muted/30 transition-colors gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{preset.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{preset.description}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-label font-medium text-muted-foreground/70 bg-muted/40 px-2 py-0.5 rounded-full">
                      Budget: {d.budgetAmount.toLocaleString('da-DK')} kr.
                    </span>
                    <span className="text-label font-medium text-muted-foreground/70 bg-muted/40 px-2 py-0.5 rounded-full">
                      Brugt: {d.totalSpent.toLocaleString('da-DK')} kr.
                    </span>
                    <span className={`text-label font-medium px-2 py-0.5 rounded-full ${
                      isOver ? 'text-red-700 bg-red-50' : 'text-emerald-700 bg-emerald-50'
                    }`}>
                      {isOver
                        ? `Over med ${(d.totalSpent - d.budgetAmount).toLocaleString('da-DK')} kr.`
                        : `Tilbage: ${d.carryOver.toLocaleString('da-DK')} kr.`
                      }
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => launchPreset(preset)}
                  className="gap-1.5 shrink-0"
                >
                  <Play className="h-3 w-3" />
                  Vis
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {showModal && activePreset && (
        <WeekTransitionBottomSheet
          summaryData={activePreset.summaryData}
          dismissCount={0}
          onOpen={() => {
            setShowModal(false);
            setShowWizard(true);
          }}
          onDismiss={() => setShowModal(false)}
        />
      )}

      {showWizard && activePreset && (
        <WeekTransitionWizard
          summaryData={activePreset.summaryData}
          cachedAiSummary={null}
          monthlySavings={activePreset.summaryData.budgetAmount - activePreset.summaryData.totalSpent}
          onAcknowledge={async () => {
            toast.success('Test: ugeskifte bekræftet (ikke gemt)');
            setShowWizard(false);
          }}
          onDismiss={() => setShowWizard(false)}
          onExpenseAdded={async () => {
            return activePreset.summaryData;
          }}
        />
      )}
    </div>
  );
}

function MonthTransitionSection() {
  const [showModal, setShowModal] = useState(false);
  const [activePreset, setActivePreset] = useState<ScenarioPreset | null>(null);
  const [showCustom, setShowCustom] = useState(false);

  const [customSummary, setCustomSummary] = useState<MonthSummary>({
    year: prevYear,
    month: prevMonth,
    totalSpent: 3500,
    budgetAmount: 4000,
    expenseCount: 10,
    wasOnBudget: true,
  });
  const [customCurrentStreak, setCustomCurrentStreak] = useState(2);
  const [customLongestStreak, setCustomLongestStreak] = useState(2);
  const [customHasStreak, setCustomHasStreak] = useState(true);
  const [customDefaultBudget, setCustomDefaultBudget] = useState(4000);
  const [resetting, setResetting] = useState(false);

  function launchPreset(preset: ScenarioPreset) {
    setActivePreset(preset);
    setShowModal(true);
  }

  function launchCustom() {
    const streak: QuickExpenseStreak | null = customHasStreak
      ? { ...BASE_STREAK, current_streak: customCurrentStreak, longest_streak: customLongestStreak }
      : null;

    setActivePreset({
      label: 'Brugerdefineret',
      description: '',
      summary: { ...customSummary, wasOnBudget: customSummary.budgetAmount > 0 && customSummary.totalSpent <= customSummary.budgetAmount },
      streak,
      defaultBudget: customDefaultBudget,
    });
    setShowModal(true);
  }

  async function resetCurrentUserTransition() {
    setResetting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Ikke logget ind'); return; }

      const { error } = await supabase
        .from('quick_expense_month_transitions')
        .delete()
        .eq('user_id', user.id)
        .eq('year', curYear)
        .eq('month', curMonth);

      if (error) throw error;
      toast.success(`Transition for ${DANISH_MONTHS[curMonth - 1]} ${curYear} er nulstillet — genindlæs Nuvio Flow siden for at se modalen igen.`);
    } catch {
      toast.error('Kunne ikke nulstille');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Test: Månedsskifte-modal</h2>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Forhåndsvisning og test af MonthTransitionModal under forskellige brugerscenarier.
          Modalen vises normalt automatisk ved starten af en ny måned.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            Nulstil overgang for indeværende måned
          </CardTitle>
          <CardDescription>
            Slet din transition-markering for {DANISH_MONTHS[curMonth - 1]} {curYear}, så modalen vises igen næste gang du åbner Nuvio Flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            onClick={resetCurrentUserTransition}
            disabled={resetting}
            className="gap-2"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {resetting ? 'Nulstiller…' : `Nulstil ${DANISH_MONTHS[curMonth - 1]} overgang`}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            Foruddefinerede scenarier
          </CardTitle>
          <CardDescription>
            Tryk på et scenarie for at se modalen i den pågældende tilstand. Data er kun til preview — intet gemmes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {PRESETS.map((preset, i) => (
            <div key={i} className="flex items-center justify-between py-3 px-4 rounded-xl border border-border/60 hover:bg-muted/30 transition-colors gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{preset.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{preset.description}</p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {preset.summary.budgetAmount > 0 && (
                    <span className="text-label font-medium text-muted-foreground/70 bg-muted/40 px-2 py-0.5 rounded-full">
                      Budget: {preset.summary.budgetAmount.toLocaleString('da-DK')} kr.
                    </span>
                  )}
                  {preset.summary.totalSpent > 0 && (
                    <span className="text-label font-medium text-muted-foreground/70 bg-muted/40 px-2 py-0.5 rounded-full">
                      Brugt: {preset.summary.totalSpent.toLocaleString('da-DK')} kr.
                    </span>
                  )}
                  {preset.streak && preset.streak.current_streak > 0 && (
                    <span className="text-label font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                      Streak: {preset.streak.current_streak} mdr.
                    </span>
                  )}
                  <span className={`text-label font-medium px-2 py-0.5 rounded-full ${
                    preset.summary.wasOnBudget
                      ? 'text-emerald-700 bg-emerald-50'
                      : preset.summary.expenseCount === 0
                      ? 'text-slate-500 bg-slate-50'
                      : 'text-amber-700 bg-amber-50'
                  }`}>
                    {preset.summary.wasOnBudget ? 'Indenfor budget' : preset.summary.expenseCount === 0 ? 'Ingen data' : 'Over budget'}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => launchPreset(preset)}
                className="gap-1.5 shrink-0"
              >
                <Play className="h-3 w-3" />
                Vis
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => setShowCustom(v => !v)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-muted-foreground" />
                Brugerdefineret scenarie
              </CardTitle>
              <CardDescription>
                Byg dit eget testscenarie med præcise værdier.
              </CardDescription>
            </div>
            {showCustom
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
            }
          </div>
        </CardHeader>

        {showCustom && (
          <CardContent className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 mb-3">Forrige måned</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Budget (kr.)</Label>
                    <Input
                      type="number"
                      value={customSummary.budgetAmount}
                      onChange={e => setCustomSummary(s => ({ ...s, budgetAmount: Number(e.target.value) }))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Brugt (kr.)</Label>
                    <Input
                      type="number"
                      value={customSummary.totalSpent}
                      onChange={e => setCustomSummary(s => ({ ...s, totalSpent: Number(e.target.value) }))}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Antal udgifter</Label>
                  <Input
                    type="number"
                    value={customSummary.expenseCount}
                    onChange={e => setCustomSummary(s => ({ ...s, expenseCount: Number(e.target.value) }))}
                    className="h-9 text-sm w-32"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 mb-3">Streak</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Vis streak-data</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Slå fra for at simulere ny bruger</p>
                  </div>
                  <Switch checked={customHasStreak} onCheckedChange={setCustomHasStreak} />
                </div>
                {customHasStreak && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nuværende streak</Label>
                      <Input
                        type="number"
                        min={0}
                        value={customCurrentStreak}
                        onChange={e => setCustomCurrentStreak(Number(e.target.value))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Længste streak</Label>
                      <Input
                        type="number"
                        min={0}
                        value={customLongestStreak}
                        onChange={e => setCustomLongestStreak(Number(e.target.value))}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50 mb-3">Ny måned</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Standard-budget forslag (kr.)</Label>
                <Input
                  type="number"
                  value={customDefaultBudget}
                  onChange={e => setCustomDefaultBudget(Number(e.target.value))}
                  className="h-9 text-sm w-48"
                />
              </div>
            </div>

            <div className="pt-1">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 text-xs text-muted-foreground mb-4">
                <span>Beregnet status:</span>
                <span className={`font-semibold ${customSummary.budgetAmount > 0 && customSummary.totalSpent <= customSummary.budgetAmount ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {customSummary.budgetAmount > 0
                    ? customSummary.totalSpent <= customSummary.budgetAmount
                      ? `Indenfor budget (${customSummary.budgetAmount - customSummary.totalSpent} kr. sparet)`
                      : `Over budget (${customSummary.totalSpent - customSummary.budgetAmount} kr. over)`
                    : 'Ingen budget sat'
                  }
                </span>
              </div>
              <Button onClick={launchCustom} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Play className="h-3.5 w-3.5" />
                Vis brugerdefineret modal
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {showModal && activePreset && (
        <MonthTransitionModal
          currentYear={curYear}
          currentMonth={curMonth}
          prevSummary={activePreset.summary}
          streak={activePreset.streak}
          defaultBudget={activePreset.defaultBudget}
          onConfirm={async (amount) => {
            toast.success(`Test: budget sat til ${amount.toLocaleString('da-DK')} kr. (ikke gemt)`);
            setShowModal(false);
          }}
          onDismiss={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export default function AdminNuvioFlowPage() {
  const [streak, setStreak] = useState(5);
  const [healthPct, setHealthPct] = useState(82);
  const [overBudget, setOverBudget] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState(8000);
  const [spentPct, setSpentPct] = useState(38);

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = daysInMonth - now.getDate() + 1;
  const totalSpent = overBudget
    ? Math.round(monthlyBudget * 1.1)
    : Math.round(monthlyBudget * (spentPct / 100));

  const previewConfig: PreviewConfig = {
    streak,
    healthPct: overBudget ? 0 : healthPct,
    overBudget,
    monthlyBudget,
    totalSpent,
    remainingDays,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-16">
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Nuvio Flow — Budget Status Card</h1>
          <p className="text-sm text-muted-foreground">Forhåndsvisning af kortet med justerbare parametre.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Forhåndsvisning</p>
            <BudgetStatusCardPreview cfg={previewConfig} />
          </div>

          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Kontrolpanel</CardTitle>
              <CardDescription className="text-sm">Juster parametrene for at se kortets forskellige tilstande.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Streak (måneder)</Label>
                  <div className="flex items-center gap-1.5">
                    <Flame className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-sm font-bold tabular-nums text-amber-700 w-5 text-right">{streak}</span>
                  </div>
                </div>
                <Slider
                  min={0}
                  max={36}
                  step={1}
                  value={[streak]}
                  onValueChange={([v]) => setStreak(v)}
                  className="w-full"
                />
                <p className="text-label text-muted-foreground">0 = ingen streak-badge vises</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Flow Score</Label>
                  <span className="text-sm font-bold tabular-nums w-8 text-right">{overBudget ? '—' : healthPct}</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[healthPct]}
                  onValueChange={([v]) => setHealthPct(v)}
                  disabled={overBudget}
                  className="w-full"
                />
                <div className="grid grid-cols-4 text-xs text-muted-foreground/60 font-medium">
                  <span>Stram op</span>
                  <span className="text-center">Hold kursen</span>
                  <span className="text-center">Godt tempo</span>
                  <span className="text-right">Flow</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Forbrug</Label>
                  <span className="text-sm font-bold tabular-nums w-12 text-right">{spentPct}%</span>
                </div>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[spentPct]}
                  onValueChange={([v]) => setSpentPct(v)}
                  disabled={overBudget}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Månedligt rådighedsbeløb</Label>
                  <span className="text-sm font-bold tabular-nums">{monthlyBudget.toLocaleString('da-DK')} kr.</span>
                </div>
                <Slider
                  min={1000}
                  max={30000}
                  step={500}
                  value={[monthlyBudget]}
                  onValueChange={([v]) => setMonthlyBudget(v)}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-border">
                <div>
                  <Label className="text-sm font-medium">Over budget</Label>
                  <p className="text-label text-muted-foreground mt-0.5">Aktiverer rød overbudget-tilstand</p>
                </div>
                <Switch
                  checked={overBudget}
                  onCheckedChange={setOverBudget}
                />
              </div>

              <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scoringmodel</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Månedlig belønning: <span className="font-semibold text-foreground">0–15 point</span> (gradueret efter flow score)</p>
                  <p>Straf ved overskridelse: <span className="font-semibold text-red-600">−30 point</span> (fast, binær)</p>
                  <p>Gulv: <span className="font-semibold text-foreground">0</span> — kan aldrig gå i minus</p>
                  <p>Loft: <span className="font-semibold text-foreground">ingen</span> — scoren vokser ubegrænset</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="border-t border-border/60 pt-10">
        <WeekTransitionSection />
      </div>

      <div className="border-t border-border/60 pt-10">
        <MonthTransitionSection />
      </div>
    </div>
  );
}
