'use client';

import { Eye, EyeOff } from 'lucide-react';
import type { HomeCardKey } from '@/lib/home-card-config';
import { useHomeCard } from './home-card-context';

interface CardVisibilityToggleProps {
  cardKey: HomeCardKey;
  mode?: 'absolute' | 'inline';
}

export function CardVisibilityToggle({ cardKey, mode = 'absolute' }: CardVisibilityToggleProps) {
  const { isAdmin, cardVisibility, togglingCard, onToggleCard } = useHomeCard();
  if (!isAdmin) return null;

  const visible = cardVisibility[cardKey];
  const isToggling = togglingCard === cardKey;

  const btn = (
    <button
      onClick={(e) => { e.stopPropagation(); onToggleCard(cardKey); }}
      disabled={isToggling}
      title={visible ? 'Skjul for brugere' : 'Vis for brugere'}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold border transition-all shadow-sm ${
        visible
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
          : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
      }`}
    >
      {visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      {visible ? 'Synlig' : 'Skjult'}
    </button>
  );

  if (mode === 'inline') return btn;

  return (
    <>
      {!visible && (
        <div className="absolute inset-0 z-10 rounded-[inherit] bg-foreground/5 border-2 border-dashed border-rose-300/60 pointer-events-none" />
      )}
      <div className="absolute top-2 right-2 z-20">{btn}</div>
    </>
  );
}
