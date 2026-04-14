'use client';

import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/number-helpers';
import { useSettings } from '@/lib/settings-context';
import { CardVisibilityToggle } from './card-visibility-toggle';
import { useHomeCard } from './home-card-context';
import type { InvestmentProjection } from '@/lib/home-calculations';

interface SavingsInvestmentCardProps {
  projection: InvestmentProjection;
  dimmed: boolean;
}

export function SavingsInvestmentCard({ projection, dimmed }: SavingsInvestmentCardProps) {
  const router = useRouter();
  const { design } = useSettings();
  const { isAdmin } = useHomeCard();
  const fc = (v: number) => formatCurrency(v, { roundToHundreds: false, decimals: 0 });

  return (
    <div className={cn(dimmed && 'opacity-50')}>
      {isAdmin && (
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">Investering</span>
          <CardVisibilityToggle cardKey="savings_investment" mode="inline" />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-white/80 shadow-sm overflow-hidden">
          <div className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">Investering</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl bg-black/[0.03] p-3">
                <p className="text-xs text-muted-foreground mb-1">Indskudt</p>
                <p className="text-sm font-bold tabular-nums">{fc(projection.totalIn10)}</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">10 år</p>
              </div>
              <div className="rounded-xl p-3" style={{ background: `${design.gradientFrom}12` }}>
                <p className="text-xs text-muted-foreground mb-1">Projektet</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: design.gradientFrom }}>{fc(projection.proj10)}</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">med afkast</p>
              </div>
            </div>
            {projection.gains10 > 0 && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Afkast: <span className="font-semibold" style={{ color: design.gradientFrom }}>+{fc(projection.gains10)}</span>
              </p>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-black/[0.04] pt-3 mt-3">
              <span>{fc(projection.monthlyAmount)}/md.</span>
              <button
                onClick={() => router.push('/investering')}
                className="hover:text-foreground flex items-center gap-0.5 transition-colors"
              >
                Justér <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
