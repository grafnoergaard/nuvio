'use client';

import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickExpenseActionCardProps {
  dimmed?: boolean;
  onClick: () => void;
}

export function QuickExpenseActionCard({ dimmed, onClick }: QuickExpenseActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full rounded-full border border-emerald-200/70 bg-white/85 px-4 py-3.5 shadow-sm',
        'flex items-center justify-center gap-2 text-sm font-semibold text-[#0E3B43]',
        'transition-all duration-200 hover:border-emerald-300 hover:bg-emerald-50/80 hover:shadow-md active:scale-[0.99]',
        dimmed && 'opacity-50'
      )}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0E3B43] text-[#2ED3A7] transition-transform duration-200 group-hover:scale-105">
        <Plus className="h-4 w-4" />
      </span>
      Tilføj udgift
    </button>
  );
}
