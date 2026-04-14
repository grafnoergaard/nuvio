'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  X,
  Info,
  ChevronDown,
  ChevronRight,
  Settings2,
} from 'lucide-react';

import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getCardStyle, getTopBarStyle, useSettings } from '@/lib/settings-context';

import {
  getFlowSavingsTotals,
  getFlowSavingsEntries,
  resetFlowSavings,
  backfillMissedFlowSavings,
  computeSavingsMilestones,
  type FlowSavingsTotals,
  type FlowSavingsEntry,
  type SavingsMilestonesResult,
} from '@/lib/flow-savings-service';
import { FlowMilestonesSection } from '@/components/flow-milestones-section';

const DANISH_MONTHS_FULL = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
];

const DANISH_MONTHS_SHORT = [
  'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
];

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getISOWeekForEntry(year: number, month: number, weekNumber: number): number {
  const weeks: Array<{ start: Date; end: Date }> = [];
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const dayOfWeek = firstDay.getDay();
  const daysFromWeekStart = (dayOfWeek - 1 + 7) % 7;
  const customWeekStart = new Date(firstDay);
  customWeekStart.setDate(firstDay.getDate() - daysFromWeekStart);
  let ws = new Date(customWeekStart);
  while (ws <= lastDay) {
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);
    const clampedStart = ws < firstDay ? new Date(firstDay) : new Date(ws);
    weeks.push({ start: clampedStart, end: we > lastDay ? new Date(lastDay) : new Date(we) });
    ws.setDate(ws.getDate() + 7);
  }
  const week = weeks[weekNumber - 1];
  if (!week) return weekNumber;
  return getISOWeekNumber(week.start);
}

function formatDKK(value: number): string {
  return value.toLocaleString('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

const FLOW_SAVINGS_CACHE_TTL = 60_000;
let flowSavingsCache: {
  at: number;
  totals: FlowSavingsTotals | null;
  entries: FlowSavingsEntry[];
  milestonesResult: SavingsMilestonesResult | null;
} | null = null;

function getFlowSavingsCache() {
  if (!flowSavingsCache) return null;
  if (Date.now() - flowSavingsCache.at > FLOW_SAVINGS_CACHE_TTL) {
    flowSavingsCache = null;
    return null;
  }
  return flowSavingsCache;
}

export default function OpsparingPage() {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const now = new Date();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const color = 'rgb(236,253,245)';
    document.body.style.backgroundColor = color;
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
    return () => {
      document.body.style.backgroundColor = '';
      if (meta) meta.content = '#f8f9f2';
    };
  }, []);

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-white"
      style={{ backgroundColor: 'rgb(236,253,245)' }}
    >
      <div
        className="max-w-lg mx-auto pb-32 sm:pb-16"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}
      >
        <div className="mb-6 px-4">
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">
                {DANISH_MONTHS_FULL[now.getMonth()]} {now.getFullYear()}
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                Flow Opsparing
              </h1>
            </div>
            <button
              onClick={() => setShowInfoModal(true)}
              className="h-10 w-10 rounded-full border-2 border-emerald-400/60 bg-white/70 flex items-center justify-center text-emerald-600 hover:border-emerald-500 hover:bg-emerald-50 transition-all duration-200 shadow-sm shrink-0"
              aria-label="Om Flow Opsparing"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
        </div>

        <FlowSavingsTab />
      </div>

      {showInfoModal && (
        <OpsparingInfoModal onClose={() => setShowInfoModal(false)} />
      )}
    </div>
  );
}

function OpsparingInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        style={{ animation: 'slideUp 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl bg-gradient-to-r from-emerald-400 to-teal-400" />
        <div className="px-6 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-start justify-between mb-4">
            <div className="h-10 w-10 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center shrink-0">
              <Info className="h-5 w-5 text-emerald-600" />
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-1">Flow Opsparing</h2>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600/70 mb-4">Hvordan fungerer det?</p>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              <span className="font-semibold text-foreground">Flow Opsparing</span> er penge du automatisk sparer, hver gang du afslutter en uge under dit Nuvio Flow-budget. Overskuddet overføres direkte til din Flow-saldo.
            </p>
            <p>
              Jo mere præcist du holder dit ugentlige Flow-budget, jo mere akkumulerer du over tid — uden at tænke over det.
            </p>
          </div>
          <button
            onClick={onClose}
            className="mt-6 w-full h-12 rounded-2xl font-semibold text-sm text-white transition-all duration-200 active:scale-[0.98]"
            style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
          >
            Forstået
          </button>
        </div>
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

function FlowSavingsTab() {
  const { design } = useSettings();
  const cached = getFlowSavingsCache();
  const [totals, setTotals] = useState<FlowSavingsTotals | null>(cached?.totals ?? null);
  const [entries, setEntries] = useState<FlowSavingsEntry[]>(cached?.entries ?? []);
  const [milestonesResult, setMilestonesResult] = useState<SavingsMilestonesResult | null>(cached?.milestonesResult ?? null);
  const [loading, setLoading] = useState(!cached);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    if (!flowSavingsCache) setLoading(true);
    try {
      const [backfillResult, t, e] = await Promise.all([
        backfillMissedFlowSavings(),
        getFlowSavingsTotals(),
        getFlowSavingsEntries(),
      ]);
      setTotals(t);
      setEntries(e);
      if (t && e.length > 0) {
        const result = await computeSavingsMilestones(t.current_balance, e);
        setMilestonesResult(result);
        flowSavingsCache = { at: Date.now(), totals: t, entries: e, milestonesResult: result };
      } else {
        setMilestonesResult(null);
        flowSavingsCache = { at: Date.now(), totals: t, entries: e, milestonesResult: null };
      }
      if (backfillResult.backfilledCount > 0) {
        toast.success(`${backfillResult.backfilledCount} ${backfillResult.backfilledCount === 1 ? 'uge' : 'uger'} med opsparing gendannet`);
      }
    } catch {
      toast.error('Kunne ikke hente opsparing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleReset() {
    setResetting(true);
    try {
      await resetFlowSavings();
      flowSavingsCache = null;
      toast.success('Flow-opsparing nulstillet');
      setShowResetConfirm(false);
      load();
    } catch {
      toast.error('Kunne ikke nulstille');
    } finally {
      setResetting(false);
    }
  }

  const balance = totals?.current_balance ?? 0;
  const lifetimeTotal = totals?.lifetime_total ?? 0;
  const weekCount = totals?.week_count ?? 0;
  const hasData = balance > 0 || weekCount > 0;
  const cardMedium = design.cardMedium;
  const cardStyleBase = getCardStyle(cardMedium, design.gradientFrom, design.gradientTo);
  const topBarStyleOverride = getTopBarStyle(cardMedium, design.gradientFrom, design.gradientTo);

  if (loading) {
    return (
      <div className="px-4 space-y-3">
        <div className="h-40 rounded-2xl bg-white/60 animate-pulse" />
        <div className="h-20 rounded-2xl bg-white/60 animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      <div
        className={cn(
          'mx-4 rounded-2xl border shadow-sm mb-6 transition-all duration-500',
          hasData
            ? 'bg-gradient-to-br from-emerald-50/80 via-teal-50/30 to-white border-emerald-200/50'
            : 'bg-white/80 border-white/30'
        )}
        style={cardStyleBase}
      >
        {topBarStyleOverride && hasData && (
          <div style={topBarStyleOverride} />
        )}

        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-2 transition-all duration-500',
              hasData ? 'bg-emerald-100 ring-emerald-200' : 'bg-muted/20 ring-muted/10'
            )}>
              <Wallet className={cn('h-4 w-4', hasData ? 'text-emerald-600' : 'text-muted-foreground/40')} />
            </div>
            <div>
              <p className="text-label font-semibold uppercase tracking-widest text-muted-foreground/50 leading-none mb-0.5">
                Flow-opsparing
              </p>
              {hasData && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold tracking-wide text-white bg-emerald-500">
                  Aktiv
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => document.getElementById('flow-opsparing-detaljer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-black/5 transition-all duration-200"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Se detaljer
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          </div>
        </div>

        {!hasData ? (
          <div className="px-5 pb-6 text-center">
            <p className="text-sm font-semibold text-foreground mb-1">Ingen flow-opsparing endnu</p>
            <p className="text-sm text-muted-foreground/60 leading-relaxed">
              Penge du sparer via Nuvio Flow-budgettet akkumuleres her automatisk efter hvert ugeskift.
            </p>
          </div>
        ) : (
          <div className="px-5 pb-5 space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium leading-snug mb-1 text-emerald-800">
                  {weekCount === 1
                    ? 'Sparet over 1 uge'
                    : `Sparet over ${weekCount} uger`}
                </p>
                <p className="text-3xl font-semibold tracking-tight tabular-nums leading-none text-emerald-700">
                  {formatDKK(balance)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  nuværende saldo
                </p>
              </div>

              {lifetimeTotal > balance && (
                <div className="flex gap-2 shrink-0">
                  <div className="rounded-xl bg-white/60 border border-black/5 px-3 py-2 text-center min-w-[64px]">
                    <p className="text-xs font-medium text-muted-foreground/70 leading-snug mb-0.5">Livstid</p>
                    <p className="text-sm font-semibold tracking-tight tabular-nums text-foreground">
                      {formatDKK(lifetimeTotal)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground tracking-wide">Flow opsparing</span>
                <span className="text-xs font-bold tabular-nums text-emerald-700">{weekCount} uger</span>
              </div>
              <div className="relative h-2 rounded-full bg-black/[0.06] overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-emerald-400 to-teal-400"
                  style={{ width: lifetimeTotal > 0 ? `${Math.min(100, Math.max(8, (balance / lifetimeTotal) * 100))}%` : '100%' }}
                />
              </div>
              <p className="text-label text-muted-foreground/60 leading-snug">
                {lifetimeTotal > balance
                  ? `${formatDKK(balance)} af ${formatDKK(lifetimeTotal)} i alt`
                  : `${weekCount} ${weekCount === 1 ? 'uge' : 'uger'} med positiv opsparing`}
              </p>
            </div>
          </div>
        )}
      </div>


      <div id="flow-opsparing-detaljer">
        {milestonesResult && (
          <FlowMilestonesSection result={milestonesResult} />
        )}
      </div>

      {entries.length > 0 && (
        <div className="mb-5">
          <button
            onClick={() => setHistoryOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-black/[0.02] transition-colors"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Historik ({entries.length} {entries.length === 1 ? 'uge' : 'uger'})
            </p>
            <ChevronDown className={cn(
              'h-4 w-4 text-muted-foreground/40 transition-transform duration-200',
              historyOpen && 'rotate-180'
            )} />
          </button>
          {historyOpen && (
            <div className="border-t border-b border-border/30 divide-y divide-border/30">
              {entries.map(entry => (
                <FlowSavingsEntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      )}

      {hasData && (
        <div className="mx-4">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 w-full px-4 py-3 rounded-2xl border border-border/50 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all duration-200"
          >
            <RotateCcw className="h-4 w-4 shrink-0" />
            Start forfra
          </button>
          <p className="text-[10px] text-muted-foreground/50 text-center mt-2 leading-relaxed px-2">
            Din livstids-total bevares — kun din nuværende saldo og historik nulstilles.
          </p>
        </div>
      )}

      {showResetConfirm && (
        <ResetConfirmOverlay
          onConfirm={handleReset}
          onClose={() => setShowResetConfirm(false)}
          resetting={resetting}
        />
      )}
    </div>
  );
}

const FlowSavingsEntryRow = memo(function FlowSavingsEntryRow({ entry }: { entry: FlowSavingsEntry }) {
  const isPositive = entry.amount > 0;
  const monthName = DANISH_MONTHS_SHORT[entry.month - 1];
  const isoWeek = getISOWeekForEntry(entry.year, entry.month, entry.week_number);

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 bg-white">
      <div className={cn(
        'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
        isPositive ? 'bg-emerald-50' : 'bg-amber-50'
      )}>
        {isPositive
          ? <TrendingUp className="h-4 w-4 text-emerald-600" />
          : <TrendingDown className="h-4 w-4 text-amber-500" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Uge {isoWeek}
        </p>
        <p className="text-xs text-muted-foreground/60">
          {monthName} {entry.year} · budget {formatDKK(entry.budget_amount)} · brugt {formatDKK(entry.total_spent)}
        </p>
      </div>
      <p className={cn(
        'text-sm font-semibold tabular-nums shrink-0',
        isPositive ? 'text-emerald-600' : 'text-amber-500'
      )}>
        {isPositive ? '+' : ''}{formatDKK(entry.amount)}
      </p>
    </div>
  );
});

function ResetConfirmOverlay({
  onConfirm,
  onClose,
  resetting,
}: {
  onConfirm: () => void;
  onClose: () => void;
  resetting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-sm bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        style={{ animation: 'slideUp 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        <p className="text-base font-semibold mb-1.5">Start forfra?</p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          Din nuværende saldo og historik nulstilles. Din livstids-total bevares og vises diskret på siden.
        </p>
        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 h-12 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
          >
            Annuller
          </button>
          <button
            onClick={onConfirm}
            disabled={resetting}
            className="flex-1 h-12 rounded-xl bg-foreground hover:bg-foreground/90 text-background text-sm font-semibold transition-all duration-200 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
          >
            {resetting ? 'Nulstiller…' : 'Start forfra'}
          </button>
        </div>
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
