'use client';

import { CircleCheck as CheckCircle2, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCardStyle, getTopBarStyle, useSettings } from '@/lib/settings-context';
import { getVacationAccentColor, getVacationAccentMid, getVacationCardSurfaceStyle, getVacationTopBarCard, withAlpha } from '@/lib/vacation-theme';
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
  isVacationMode?: boolean;
}

export function FlowMilestonesSection({ result, isVacationMode = false }: Props) {
  const { design } = useSettings();
  const { weeklyRate, milestones } = result;
  const hasRate = weeklyRate > 0;
  const pendingMilestones = milestones.filter(m => !m.alreadyReached);
  const reachedMilestones = milestones.filter(m => m.alreadyReached);
  const vacationAccent = getVacationAccentColor(design);
  const vacationAccentMid = getVacationAccentMid(vacationAccent);
  const cardMedium = design.cardMedium;
  const activeCardMedium = isVacationMode ? getVacationTopBarCard(cardMedium, vacationAccent) : cardMedium;
  const activeGradientTo = isVacationMode ? vacationAccent : design.gradientTo;
  const cardStyleBase = getCardStyle(activeCardMedium, design.gradientFrom, activeGradientTo);
  const topBarStyleOverride = getTopBarStyle(activeCardMedium, design.gradientFrom, activeGradientTo);
  const vacationCardSurfaceStyle = isVacationMode ? getVacationCardSurfaceStyle(vacationAccent) : undefined;

  if (milestones.every(m => m.alreadyReached)) {
    return (
      <div
        className="mx-4 mb-5 rounded-2xl border shadow-sm transition-all duration-500"
        style={{ ...cardStyleBase, ...vacationCardSurfaceStyle }}
      >
        {topBarStyleOverride && (
          <div style={topBarStyleOverride} />
        )}
        <div className="px-5 py-5">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2
              className="h-5 w-5 shrink-0"
              style={{ color: isVacationMode ? vacationAccent : undefined }}
            />
            <p
              className="text-sm font-semibold"
              style={{ color: isVacationMode ? '#0E3B43' : undefined }}
            >
              Alle milestones nået!
            </p>
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
      className="mx-4 mb-5 rounded-2xl border shadow-sm overflow-hidden transition-all duration-500"
      style={{ ...cardStyleBase, ...vacationCardSurfaceStyle }}
    >
      {topBarStyleOverride && (
        <div style={topBarStyleOverride} />
      )}
      <div className="px-5 pt-5 pb-1">
        <div className="flex items-center gap-2 mb-1">
          <Target
            className="h-4 w-4 shrink-0"
            style={{ color: isVacationMode ? vacationAccent : undefined }}
          />
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: isVacationMode ? withAlpha(vacationAccent, 0.7) : undefined }}
          >
            Milestones
          </p>
        </div>
        <p className="text-sm font-semibold text-foreground mb-0.5">
          Opsparingstempo
        </p>
        {hasRate ? (
          <p className="text-xs text-muted-foreground/70 leading-snug">
            Baseret på dine seneste 8 uger sparer du gennemsnitligt{' '}
            <span
              className="font-semibold"
              style={{ color: isVacationMode ? '#0E3B43' : undefined }}
            >
              {formatRate(weeklyRate)}/md.
            </span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/60 leading-snug">
            Ingen data endnu — gennemfør dine første uger for at se fremskrivning.
          </p>
        )}
      </div>

      <div className="px-5 pt-4 pb-5 space-y-5">
        {pendingMilestones.map((milestone) => (
          <MilestoneRow
            key={milestone.target}
            milestone={milestone}
            hasRate={hasRate}
            isVacationMode={isVacationMode}
            vacationAccent={vacationAccent}
            vacationAccentMid={vacationAccentMid}
          />
        ))}

        {reachedMilestones.map((milestone) => (
          <MilestoneRow
            key={milestone.target}
            milestone={milestone}
            hasRate={hasRate}
            reached
            isVacationMode={isVacationMode}
            vacationAccent={vacationAccent}
            vacationAccentMid={vacationAccentMid}
          />
        ))}
      </div>
    </div>
  );
}

function MilestoneRow({
  milestone,
  hasRate,
  reached = false,
  isVacationMode = false,
  vacationAccent,
  vacationAccentMid,
}: {
  milestone: SavingsMilestone;
  hasRate: boolean;
  reached?: boolean;
  isVacationMode?: boolean;
  vacationAccent: string;
  vacationAccentMid: string;
}) {
  const vacationFillStyle = isVacationMode
    ? {
        background: `linear-gradient(to right, ${reached ? vacationAccentMid : `${vacationAccentMid}dd`}, ${vacationAccent})`,
      }
    : undefined;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {reached ? (
            <CheckCircle2
              className="h-4 w-4 shrink-0"
              style={{ color: isVacationMode ? vacationAccent : undefined }}
            />
          ) : (
            <div
              className="h-4 w-4 rounded-full border-2 shrink-0"
              style={{ borderColor: isVacationMode ? withAlpha(vacationAccent, 0.45) : undefined }}
            />
          )}
          <span
            className={cn(
              'text-sm font-semibold',
              reached && !isVacationMode ? 'text-emerald-600' : 'text-foreground'
            )}
            style={reached && isVacationMode ? { color: '#0E3B43' } : undefined}
          >
            {formatDKK(milestone.target)}
          </span>
        </div>

        <span
          className={cn(
            'text-xs font-medium',
            reached
              ? !isVacationMode && 'text-emerald-600 font-semibold'
              : hasRate && milestone.label
                ? 'text-muted-foreground'
                : 'text-muted-foreground/50'
          )}
          style={reached && isVacationMode ? { color: '#0E3B43' } : undefined}
        >
          {reached
            ? 'Nået!'
            : hasRate && milestone.label
              ? milestone.label
              : '—'}
        </span>
      </div>

      <div
        className="relative h-2.5 rounded-full bg-black/[0.06] overflow-hidden"
        style={isVacationMode ? { backgroundColor: withAlpha(vacationAccent, 0.12) } : undefined}
      >
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out',
            !isVacationMode && reached
              ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
              : !isVacationMode
                ? 'bg-gradient-to-r from-emerald-300 to-teal-400'
                : undefined
          )}
          style={{ width: `${milestone.progressPct}%`, ...(vacationFillStyle ?? {}) }}
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
