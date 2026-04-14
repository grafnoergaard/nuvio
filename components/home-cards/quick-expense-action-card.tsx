'use client';

import { Plus } from 'lucide-react';
interface QuickExpenseActionCardProps {
  dimmed?: boolean;
  onClick: () => void;
}

export function QuickExpenseActionCard({ onClick }: QuickExpenseActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="nuvio-action-button group flex w-full items-center justify-center gap-2 border px-4 py-3.5 text-sm font-semibold shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.99]"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2ED3A7] text-[#0E3B43] transition-transform duration-200 group-hover:scale-105">
        <Plus className="h-4 w-4" />
      </span>
      Tilføj udgift
    </button>
  );
}
