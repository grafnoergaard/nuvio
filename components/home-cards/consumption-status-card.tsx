'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight, TrendingUp, TrendingDown, CircleAlert as AlertCircle, CircleCheck as CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardVisibilityToggle } from './card-visibility-toggle';
import type { ConsumptionStatus } from '@/lib/home-calculations';

const CSC_COLORS = {
  robust: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bar: 'bg-emerald-500',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  stabil: {
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    bar: 'bg-sky-500',
    icon: <TrendingUp className="h-3.5 w-3.5" />,
  },
  kan_styrkes: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    bar: 'bg-amber-500',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
  presset: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    bar: 'bg-rose-500',
    icon: <TrendingDown className="h-3.5 w-3.5" />,
  },
};

interface ConsumptionStatusCardProps {
  status: ConsumptionStatus;
  dimmed: boolean;
}

export function ConsumptionStatusCard({ status, dimmed }: ConsumptionStatusCardProps) {
  const router = useRouter();
  const csc = CSC_COLORS[status.level];

  return (
    <div className={cn('relative rounded-[8px] nuvio-card overflow-hidden', dimmed && 'opacity-50')}>
      <CardVisibilityToggle cardKey="consumption_status" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Forbrugsstatus</p>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] border text-xs font-semibold ${csc.badge}`}>
              {csc.icon}{status.label}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-bold tabular-nums">{status.pct}%</p>
            <p className="text-xs text-muted-foreground/60">af indkomst</p>
          </div>
        </div>
        <div className="w-full h-2 rounded-[8px] bg-black/[0.06] overflow-hidden mb-4">
          <div className={`h-full rounded-[8px] transition-all duration-700 ${csc.bar}`} style={{ width: `${Math.min(100, status.pct)}%` }} />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{status.advice}</p>
        <button
          onClick={() => router.push(status.ctaHref)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline transition-opacity"
        >
          {status.ctaLabel}<ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
