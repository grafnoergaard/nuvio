'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { type HomeCardKey } from '@/lib/home-card-config';
import { CardVisibilityToggle } from '@/components/home-cards/card-visibility-toggle';
import { OnboardingCard } from '@/components/home-cards/onboarding-card';
import { NuvioScoreCard } from '@/components/home-cards/nuvio-score-card';
import { FinanceGridCard } from '@/components/home-cards/finance-grid-card';
import { SavingsInvestmentCard } from '@/components/home-cards/savings-investment-card';
import { OverviewCheckupCard } from '@/components/home-cards/overview-checkup-card';
import { NextStepCard } from '@/components/home-cards/next-step-card';
import { ConsumptionStatusCard } from '@/components/home-cards/consumption-status-card';
import { KuvertHeroCard } from '@/components/home-cards/kuvert-hero-card';
import type { HomeDerived } from '@/lib/home-derived';
import type { QuickExpenseWeeklyStreak, WeeklyCarryOverSummary } from '@/lib/quick-expense-service';
import type { FlowStatusConfig } from '@/hooks/use-home-data';

const HERO_CARD_KEYS = new Set<HomeCardKey>(['streak_count', 'quick_expense_action']);

interface SectionSlotProps {
  cardKey: HomeCardKey;
  isAdmin: boolean;
  cardVisibility: Record<string, boolean>;
  derived: HomeDerived;
  categoryGroupTypes: Array<{ name: string; kind: 'income' | 'expense' | 'variable_expense' | 'savings' | 'investment' | 'frirum' }>;
  recipientCount: number;
  weeklyStreak: QuickExpenseWeeklyStreak | null;
  flowMonthlyBudget: number;
  flowMonthlySpent: number;
  flowScoreThreshold: number;
  flowStatusConfig: FlowStatusConfig;
  flowWeeklyStatus: WeeklyCarryOverSummary | null;
  openingBalance: number;
  wizardEnabled: (key: string) => boolean;
  onDismissOnboarding: () => void;
  onShowIncomeWizard: () => void;
  onShowFixedExpensesWizard: () => void;
  onShowVariableWizard: () => void;
  onShowStartBalance: () => void;
  onShowQuickExpense: () => void;
}

export function SectionSlot({
  cardKey,
  isAdmin,
  cardVisibility,
  derived,
  categoryGroupTypes,
  recipientCount,
  weeklyStreak,
  flowMonthlyBudget,
  flowMonthlySpent,
  flowScoreThreshold,
  flowStatusConfig,
  flowWeeklyStatus,
  openingBalance,
  wizardEnabled,
  onDismissOnboarding,
  onShowIncomeWizard,
  onShowFixedExpensesWizard,
  onShowVariableWizard,
  onShowStartBalance,
  onShowQuickExpense,
}: SectionSlotProps) {
  const isHeroCard = cardKey === 'streak_count' && (
    cardVisibility.streak_count || cardVisibility.quick_expense_action
  );
  const visible = isHeroCard || cardVisibility[cardKey];
  if (!visible) return null;
  const dimmed = !visible && isAdmin;

  const {
    financials, nuvioScore, consumptionStatus, nextBestActionItem,
    investmentProjection, scenarioLabel, isFullySetup, onboardingDismissed,
    setupSteps, setupProgress, completedSteps, nextStep,
  } = derived;

  switch (cardKey) {
    case 'onboarding':
      if (isFullySetup || onboardingDismissed) return null;
      return (
        <OnboardingCard
          setupSteps={setupSteps}
          setupProgress={setupProgress}
          completedSteps={completedSteps}
          nextStep={nextStep ?? null}
          openingBalance={openingBalance}
          wizardEnabled={wizardEnabled}
          onDismiss={onDismissOnboarding}
          onShowIncomeWizard={onShowIncomeWizard}
          onShowFixedExpensesWizard={onShowFixedExpensesWizard}
          onShowVariableWizard={onShowVariableWizard}
          onShowStartBalance={onShowStartBalance}
        />
      );

    case 'nuvio_score':
      if (!nuvioScore) return null;
      return <NuvioScoreCard nuvioScore={nuvioScore} categoryGroupTypes={categoryGroupTypes} dimmed={dimmed} />;

    case 'finance_grid':
      return (
        <FinanceGridCard
          financials={financials}
          recipientCount={recipientCount}
          scenarioLabel={scenarioLabel}
          dimmed={dimmed}
          onShowIncomeWizard={onShowIncomeWizard}
          onShowVariableWizard={onShowVariableWizard}
        />
      );

    case 'savings_investment':
      if (!investmentProjection) return null;
      return <SavingsInvestmentCard projection={investmentProjection} dimmed={dimmed} />;

    case 'overview_checkup':
      return <OverviewCheckupCard dimmed={dimmed} />;

    case 'savings_goals':
      return null;

    case 'next_step':
      if (!nextBestActionItem) return null;
      return <NextStepCard item={nextBestActionItem} dimmed={dimmed} />;

    case 'consumption_status':
      if (!consumptionStatus) return null;
      return <ConsumptionStatusCard status={consumptionStatus} dimmed={dimmed} />;

    case 'budget_status':
      return null;

    case 'nuvio_score_standalone':
      return null;

    case 'flow_savings':
      return null;

    case 'streak_count':
      return (
        <KuvertHeroCard
          weeklyStreak={weeklyStreak}
          flowMonthlyBudget={flowMonthlyBudget}
          flowMonthlySpent={flowMonthlySpent}
          flowScoreThreshold={flowScoreThreshold}
          flowStatusConfig={flowStatusConfig}
          flowWeeklyStatus={flowWeeklyStatus}
          showStreak={cardVisibility.streak_count}
          showQuickExpense={cardVisibility.quick_expense_action}
          onShowQuickExpense={onShowQuickExpense}
        />
      );

    case 'quick_expense_action':
      return null;

    default:
      return null;
  }
}

type SlotSharedProps = Omit<SectionSlotProps, 'cardKey'>;

interface DynamicSectionsProps extends SlotSharedProps {
  sortedCardKeys: HomeCardKey[];
  cardWidth: Record<string, 'full' | 'half'>;
}

export function DynamicSections(props: DynamicSectionsProps) {
  const { sortedCardKeys, cardWidth, cardVisibility } = props;
  const hasHeroCard = sortedCardKeys.some(key => HERO_CARD_KEYS.has(key) && cardVisibility[key]);
  const keysToRender = sortedCardKeys.reduce<HomeCardKey[]>((keys, key) => {
    if (!cardVisibility[key]) return keys;
    if (HERO_CARD_KEYS.has(key)) {
      if (hasHeroCard && !keys.includes('streak_count')) keys.push('streak_count');
      return keys;
    }
    keys.push(key);
    return keys;
  }, []);
  const result: React.ReactNode[] = [];
  let i = 0;
  while (i < keysToRender.length) {
    const key = keysToRender[i];
    const w = cardWidth[key] ?? 'full';
    if (w === 'half' && i + 1 < keysToRender.length && (cardWidth[keysToRender[i + 1]] ?? 'full') === 'half') {
      const nextKey = keysToRender[i + 1];
      result.push(
        <div key={`pair-${key}-${nextKey}`} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SectionSlot {...props} cardKey={key} />
          <SectionSlot {...props} cardKey={nextKey} />
        </div>
      );
      i += 2;
    } else {
      result.push(<SectionSlot key={key} {...props} cardKey={key} />);
      i += 1;
    }
  }
  return <>{result}</>;
}
