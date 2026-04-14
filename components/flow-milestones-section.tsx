'use client';

import { CircleCheck as CheckCircle2, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCardStyle, getTopBarStyle, useSettings } from '@/lib/settings-context';
import type { SavingsMilestone, SavingsMilestonesResult } from '@/lib/flow-savings-service';

function formatDKK(value: number): string {
  return value.toLocaleString('da-DK', {
    style: 'currency',
    currency: 'DKK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatRate(weeklyRate: number): string {
  const monthly = weeklyRate * 4.33;
  return formatDKK(Math.round(monthly));
}

interface Props {
  result: SavingsMilestonesResult;
}

export function FlowMilestonesSection({ result }: Props) {
  const { design } = useSettings();
  const { weeklyRate, milestones } = result;
  const hasRate = weeklyRate > 0;
  const pendingMilestones = milestones.filter(m => !m.alreadyReached);
  const reachedMilestones = milestones.filter(m => m.alreadyReached);
  const cardMedium = design.cardMedium;
  const cardStyleBase = getCardStyle(cardMedium, design.gradientFrom, design.gradientTo);
  const topBarStyleOverride = getTopBarStyle(cardMedium, design.gradientFrom, design.gradientTo);

  if (milestones.every(m => m.alreadyReached)) {
    return (
      <div
        className="mx-4 mb-5 rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/80 via-teal-50/20 to-white transition-all duration-500"
        style={cardStyleBase}
      >
        {topBarStyleOverride && (
          <div style={topBarStyleOverride} />
        )}
        <div className="px-5 py-5">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <p className="text-sm font-semibold text-emerald-700">Alle milestones nået!</p>
          </div>
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            Du har nået 100.000 kr. — et imponerende resultat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-4 mb-5 rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-emerald-50/60 via-white to-white shadow-sm overflow-hidden transition-all duration-500"
      style={cardStyleBase}
    >
      {topBarStyleOverride && (
        <div style={topBarStyleOverride} />
      )}
      <div className="px-5 pt-5 pb-1">
        <div className="flex items-center gap-2 mb-1">
          <Target className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600/70">
            Milestones
          </p>
        </div>
        <p className="text-sm font-semibold text-foreground mb-0.5">
          Opsparingstempo
        </p>
        {hasRate ? (
          <p className="text-xs text-muted-foreground/70 leading-snug">
            Baseret på dine seneste 8 uger sparer du gennemsnitligt{' '}
            <span className="font-semibold text-emerald-700">{formatRate(weeklyRate)}/md.</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/60 leading-snug">
            Ingen data endnu — gennemfør dine første uger for at se fremskrivning.
          </p>
        )}
      </div>

      <div className="px-5 pt-4 pb-5 space-y-5">
        {pendingMilestones.map((milestone) => (
          <MilestoneRow key={milestone.target} milestone={milestone} hasRate={hasRate} />
        ))}

        {reachedMilestones.map((milestone) => (
          <MilestoneRow key={milestone.target} milestone={milestone} hasRate={hasRate} reached />
        ))}
      </div>
    </div>
  );
}

function MilestoneRow({
  milestone,
  hasRate,
  reached = false,
}: {
  milestone: SavingsMilestone;
  hasRate: boolean;
  reached?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {reached ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          ) : (
            <div className="h-4 w-4 rounded-full border-2 border-emerald-300/60 shrink-0" />
          )}
          <span className={cn(
            'text-sm font-semibold',
            reached ? 'text-emerald-600' : 'text-foreground'
          )}>
            {formatDKK(milestone.target)}
          </span>
        </div>

        <span className={cn(
          'text-xs font-medium',
          reached
            ? 'text-emerald-600 font-semibold'
            : hasRate && milestone.label
              ? 'text-muted-foreground'
              : 'text-muted-foreground/50'
        )}>
          {reached
            ? 'Nået!'
            : hasRate && milestone.label
              ? milestone.label
              : '—'}
        </span>
      </div>

      <div className="relative h-2.5 rounded-full bg-black/[0.06] overflow-hidden">
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out',
            reached
              ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
              : 'bg-gradient-to-r from-emerald-300 to-teal-400'
          )}
          style={{ width: `${milestone.progressPct}%` }}
        />
      </div>

      {!reached && (
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground/50">
            {milestone.progressPct}% nået
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            {formatDKK(milestone.target - (milestone.progressPct / 100) * milestone.target)} tilbage
          </span>
        </div>
      )}
    </div>
  );
}
