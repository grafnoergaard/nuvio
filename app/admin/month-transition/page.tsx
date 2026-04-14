'use client';

import { useState } from 'react';
import { Flame, FlaskConical, Play, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import MonthTransitionModal from '@/components/month-transition-modal';
import type { MonthSummary, QuickExpenseStreak } from '@/lib/quick-expense-service';

const DANISH_MONTHS = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
];

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

export default function AdminMonthTransitionPage() {
  const [showModal, setShowModal] = useState(false);
  const [activePreset, setActivePreset] = useState<ScenarioPreset | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [resetting, setResetting] = useState(false);

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
      toast.success(`Transition for ${DANISH_MONTHS[curMonth - 1]} ${curYear} er nulstillet.`);
    } catch {
      toast.error('Kunne ikke nulstille');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Test: Månedsskifte-modal</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Forhåndsvisning og test af MonthTransitionModal under forskellige brugerscenarier.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            Nulstil overgang for indeværende måned
          </CardTitle>
          <CardDescription>
            Slet din transition-markering for {DANISH_MONTHS[curMonth - 1]} {curYear}, så modalen vises igen næste gang.
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
            Tryk på et scenarie for at se modalen i den pågældende tilstand.
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
                    <span className="text-label font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Flame className="h-2.5 w-2.5" />
                      {preset.streak.current_streak} mdr.
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
              <Button size="sm" variant="outline" onClick={() => launchPreset(preset)} className="gap-1.5 shrink-0">
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
              <CardDescription>Byg dit eget testscenarie med præcise værdier.</CardDescription>
            </div>
            {showCustom ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
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
