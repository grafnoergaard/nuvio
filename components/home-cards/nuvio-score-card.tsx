'use client';

import { ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { AdminCardLabel } from '@/components/admin-page-label';
import { CardVisibilityToggle } from './card-visibility-toggle';
import type { NuvioScoreResult } from '@/lib/home-calculations';

interface NuvioScoreCardProps {
  nuvioScore: NuvioScoreResult;
  categoryGroupTypes: Array<{ name: string; kind: 'income' | 'expense' | 'variable_expense' | 'savings' | 'investment' | 'frirum' }>;
  dimmed: boolean;
}

export function NuvioScoreCard({ nuvioScore, categoryGroupTypes, dimmed }: NuvioScoreCardProps) {
  const router = useRouter();

  return (
    <div className={cn('relative rounded-[8px] nuvio-card overflow-hidden', dimmed && 'opacity-50')}>
      <CardVisibilityToggle cardKey="nuvio_score" />
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-[8px]"
        style={{ background: `linear-gradient(to right, ${nuvioScore.color.bar}, ${nuvioScore.color.bar}66)` }}
      />
      <AdminCardLabel types={categoryGroupTypes} />
      <div className="p-5 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">Kuvert Score</p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{nuvioScore.primaryDriver.text}</p>
            <div className="w-full h-2 rounded-[8px] bg-black/[0.06] overflow-hidden">
              <div
                className="h-full rounded-[8px] transition-all duration-700"
                style={{ width: `${nuvioScore.score}%`, background: nuvioScore.color.bar }}
              />
            </div>
            <button
              onClick={() => router.push(nuvioScore.primaryDriver.path)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              {nuvioScore.primaryDriver.cta} <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="shrink-0 text-right">
            <div className={`text-5xl font-bold tabular-nums tracking-tight leading-none ${nuvioScore.color.text}`}>
              {nuvioScore.score}
            </div>
            <div className="text-xs text-muted-foreground/50 mt-1 mb-2">/ 100</div>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-[8px] text-xs font-bold border ${nuvioScore.color.badge}`}>
              {nuvioScore.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
