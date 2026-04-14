'use client';

import { useState, useEffect, useCallback } from 'react';
import { Wallet, TrendingUp, ChevronRight, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings, getCardStyle, getTopBarStyle } from '@/lib/settings-context';
import { useRouter } from 'next/navigation';
import { getFlowSavingsTotals, type FlowSavingsTotals } from '@/lib/flow-savings-service';
import { useAuth } from '@/lib/auth-context';

function formatDKK(value: number): string {
  return value.toLocaleString('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function FlowSavingsCard() {
  const { user } = useAuth();
  const { design } = useSettings();
  const router = useRouter();

  const [totals, setTotals] = useState<FlowSavingsTotals | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getFlowSavingsTotals();
      setTotals(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const cardMedium = design.cardMedium;
  const cardStyleBase = getCardStyle(cardMedium, design.gradientFrom, design.gradientTo);
  const topBarStyleOverride = getTopBarStyle(cardMedium, design.gradientFrom, design.gradientTo);

  const balance = totals?.current_balance ?? 0;
  const weekCount = totals?.week_count ?? 0;
  const lifetimeTotal = totals?.lifetime_total ?? 0;
  const hasData = balance > 0 || weekCount > 0;

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card shadow-sm animate-pulse" style={{ height: 130 }} />
    );
  }

  return (
    <div
      className={cn(
        'rounded-2xl border shadow-sm transition-all duration-500',
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
            onClick={() => router.push('/opsparing')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-black/5 transition-all duration-200"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Se detaljer
          </button>
          <button
            onClick={() => router.push('/opsparing')}
            className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="px-5 pb-6 text-center">
          <p className="text-sm font-semibold text-foreground mb-1">Ingen flow-opsparing endnu</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Penge du sparer via Nuvio Flow akkumuleres automatisk her.
          </p>
          <button
            onClick={() => router.push('/opsparing')}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
          >
            Gå til Opsparing <ChevronRight className="h-3 w-3" />
          </button>
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
  );
}
