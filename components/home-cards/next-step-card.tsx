'use client';

import { useRouter } from 'next/navigation';
import { Target, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardVisibilityToggle } from './card-visibility-toggle';

interface NextStepItem {
  text: string;
  cta: string;
  path: string;
}

interface NextStepCardProps {
  item: NextStepItem;
  dimmed: boolean;
}

export function NextStepCard({ item, dimmed }: NextStepCardProps) {
  const router = useRouter();

  return (
    <div className={cn('relative rounded-[8px] nuvio-card overflow-hidden', dimmed && 'opacity-50')}>
      <CardVisibilityToggle cardKey="next_step" />
      <div className="px-5 py-4 flex items-start gap-3">
        <div className="shrink-0 h-8 w-8 rounded-[8px] bg-emerald-50 border border-emerald-200/60 flex items-center justify-center mt-0.5">
          <Target className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600/70 mb-1">Næste skridt</p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{item.text}</p>
          <button
            onClick={() => router.push(item.path)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-[8px] border border-black/10 text-foreground hover:bg-black/5 transition-colors"
          >
            {item.cta}<ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
