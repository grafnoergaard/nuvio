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
      className="group flex w-full items-center justify-center gap-2 rounded-full border border-[#0E3B43] bg-[#0E3B43] px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#092F35] hover:shadow-md active:scale-[0.99]"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2ED3A7] text-[#0E3B43] transition-transform duration-200 group-hover:scale-105">
        <Plus className="h-4 w-4" />
      </span>
      Tilføj udgift
    </button>
  );
}
