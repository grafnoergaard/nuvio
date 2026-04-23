function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeRecoveryScore(
  budget: number,
  spent: number,
  daysInPeriod: number,
  daysRemaining: number,
  threshold: number
): number | null {
  if (budget <= 0 || daysInPeriod <= 0) return null;

  const remaining = budget - spent;
  if (spent > budget) return 0;
  if (daysRemaining <= 0) return remaining >= 0 ? 100 : 0;

  const idealDailyRate = budget / daysInPeriod;
  const affordableDailyRate = remaining / daysRemaining;
  const recoveryRatio = idealDailyRate > 0 ? affordableDailyRate / idealDailyRate : 0;

  if (recoveryRatio >= 1 + threshold) return 100;
  if (recoveryRatio <= 0) return 0;

  return Math.round(clamp((recoveryRatio / (1 + threshold)) * 100, 0, 100));
}

export interface KuvertLiveScoreInput {
  permanentScore: number;
  monthScore?: number | null;
  currentWeekBudget?: number | null;
  currentWeekSpent?: number | null;
  currentWeekDaysInPeriod?: number | null;
  currentWeekDaysRemaining?: number | null;
  flowScoreThreshold?: number;
}

export interface KuvertLiveScoreResult {
  displayScore: number;
  liveAdjustment: number;
  weekScore: number | null;
}

export function computeKuvertLiveScore({
  permanentScore,
  monthScore,
  currentWeekBudget,
  currentWeekSpent,
  currentWeekDaysInPeriod,
  currentWeekDaysRemaining,
  flowScoreThreshold = 0.15,
}: KuvertLiveScoreInput): KuvertLiveScoreResult {
  const safePermanentScore = Math.max(0, Math.round(permanentScore));
  const safeMonthScore =
    typeof monthScore === 'number' && Number.isFinite(monthScore)
      ? clamp(Math.round(monthScore), 0, 100)
      : null;

  const weekScore =
    typeof currentWeekBudget === 'number' &&
    typeof currentWeekSpent === 'number' &&
    typeof currentWeekDaysInPeriod === 'number' &&
    typeof currentWeekDaysRemaining === 'number'
      ? computeRecoveryScore(
          currentWeekBudget,
          currentWeekSpent,
          currentWeekDaysInPeriod,
          currentWeekDaysRemaining,
          flowScoreThreshold
        )
      : null;

  const monthAdjustment =
    safeMonthScore === null ? 0 : clamp(Math.round((safeMonthScore - 50) / 8), -6, 6);

  const weeklyAdjustment =
    weekScore === null ? 0 : clamp(Math.round((weekScore - 50) / 7), -7, 7);

  const momentumAdjustment =
    safeMonthScore === null || weekScore === null
      ? 0
      : safeMonthScore >= 85 && weekScore >= 80
        ? 3
        : safeMonthScore <= 25 || weekScore <= 20
          ? -3
          : 0;

  const liveAdjustment = clamp(monthAdjustment + weeklyAdjustment + momentumAdjustment, -15, 16);

  return {
    displayScore: Math.max(0, safePermanentScore + liveAdjustment),
    liveAdjustment,
    weekScore,
  };
}
