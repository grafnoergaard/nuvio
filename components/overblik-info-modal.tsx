'use client';

import { X, Info } from 'lucide-react';

interface OverblikInfoModalProps {
  onClose: () => void;
}

export function OverblikInfoModal({ onClose }: OverblikInfoModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        style={{ animation: 'slideUp 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl bg-gradient-to-r from-emerald-400 to-teal-400" />
        <div className="px-6 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-start justify-between mb-4">
            <div className="h-10 w-10 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center shrink-0">
              <Info className="h-5 w-5 text-emerald-600" />
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-1">Overblik</h2>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600/70 mb-4">Din finansielle helhed</p>
          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              <span className="font-semibold text-foreground">Overblik</span> er din samlede finansielle dashboard. Her ser du din indkomst, faste udgifter, variable udgifter, opsparing og investering — alt samlet på ét sted.
            </p>
            <p>
              Jo mere præcist du udfylder tallene, jo mere præcist kan Nuvio hjælpe dig med at optimere din økonomi og nå dine mål hurtigere.
            </p>
          </div>
          <button
            onClick={onClose}
            className="mt-6 w-full h-12 rounded-2xl font-semibold text-sm text-white transition-all duration-200 active:scale-[0.98]"
            style={{ background: 'linear-gradient(to right, #0d9488, #10b981)' }}
          >
            Forstået
          </button>
        </div>
      </div>
      <style jsx>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
