'use client';

import { useRouter } from 'next/navigation';
import { RefreshCw, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardVisibilityToggle } from './card-visibility-toggle';
import { useHomeCard } from './home-card-context';

interface OverviewCheckupCardProps {
  dimmed: boolean;
}

export function OverviewCheckupCard({ dimmed }: OverviewCheckupCardProps) {
  const router = useRouter();
  const { isAdmin } = useHomeCard();

  return (
    <div className={cn(dimmed && 'opacity-50')}>
      {isAdmin && (
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">Checkup</span>
          <CardVisibilityToggle cardKey="overview_checkup" mode="inline" />
        </div>
      )}
      <div className="rounded-[8px] nuvio-card overflow-hidden p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">Nuvio Checkup</p>
        <p className="text-base font-bold tracking-tight mb-2">Er din plan stadig præcis?</p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          Har din løn, dine udgifter eller dine mål ændret sig? Et 2-minutters check sikrer at din plan afspejler virkeligheden.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => router.push('/checkup')}
            className="flex-1 h-11 rounded-[8px] font-semibold text-sm text-white shadow-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
          >
            <RefreshCw className="h-3.5 w-3.5" />Opdatér tal
          </button>
          <button
            onClick={() => router.push('/anbefalinger')}
            className="h-11 px-4 rounded-[8px] text-sm font-medium text-muted-foreground border border-black/10 hover:bg-black/5 transition-colors flex items-center gap-1"
          >
            Anbefalinger <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
