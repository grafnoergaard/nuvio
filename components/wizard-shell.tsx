'use client';

import { useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';

interface StepDotsProps {
  current: number;
  total: number;
}

export function StepDots({ current, total }: StepDotsProps) {
  return (
    <div className="flex gap-2 items-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-500 ease-out ${
            i === current
              ? 'w-5 h-[5px] bg-emerald-600'
              : i < current
              ? 'w-[5px] h-[5px] bg-emerald-400/70'
              : 'w-[5px] h-[5px] bg-foreground/10'
          }`}
        />
      ))}
    </div>
  );
}

interface WizardShellProps {
  gradient: string;
  visible: boolean;
  step: number;
  totalSteps: number;
  isDone?: boolean;
  showBack: boolean;
  showClose: boolean;
  onBack: () => void;
  onClose: () => void;
  animating: boolean;
  direction: 'forward' | 'back';
  children: React.ReactNode;
}

export function WizardShell({
  gradient,
  visible,
  step,
  totalSteps,
  isDone = false,
  showBack,
  showClose,
  onBack,
  onClose,
  animating,
  direction,
  children,
}: WizardShellProps) {
  const contentStyle: React.CSSProperties = {
    opacity: animating ? 0 : 1,
    transform: animating
      ? direction === 'forward'
        ? 'translateX(16px)'
        : 'translateX(-16px)'
      : 'translateX(0)',
    transition: 'opacity 0.22s ease, transform 0.22s ease',
  };

  return (
    <div
      className="fixed inset-0 z-50"
      style={{
        background: gradient,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease, background 0.7s ease',
        left: 'var(--sidebar-offset-global, 0px)',
      }}
    >
      <div
        className="max-w-lg mx-auto px-5 flex flex-col h-full"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)',
          paddingBottom:
            'calc(var(--mobile-nav-height, 58px) + env(safe-area-inset-bottom, 0px) + 1rem)',
        }}
      >
        <div className="flex items-center justify-between pb-2 shrink-0">
          <div className="w-10">
            {showBack && (
              <button
                onClick={onBack}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/60 border border-white/40 text-foreground/60 hover:text-foreground hover:bg-white/80 transition-all active:scale-95"
                aria-label="Tilbage"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
          </div>

          {!isDone ? (
            <StepDots current={step} total={totalSteps} />
          ) : (
            <div />
          )}

          <div className="w-10 flex justify-end">
            {showClose && (
              <button
                onClick={onClose}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/60 border border-white/40 text-foreground/50 hover:text-foreground hover:bg-white/80 transition-all active:scale-95"
                aria-label="Luk"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pt-8 pb-6 w-full">
          <div style={contentStyle} className="flex flex-col">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function useWizardAnimation() {
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  function animate(dir: 'forward' | 'back', callback: () => void) {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      callback();
      setAnimating(false);
    }, 220);
  }

  return { animating, direction, animate };
}
