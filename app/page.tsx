'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { OnboardingIntro } from '@/components/onboarding-intro';
import { IncomeWizard } from '@/components/income-wizard';
import { FixedExpensesWizard } from '@/components/fixed-expenses-wizard';
import { VariableForbrugWizardModal } from '@/components/variable-forbrug-wizard-modal';
import { toast } from 'sonner';
import { HomeCardProvider } from '@/components/home-cards/home-card-context';
import { DynamicSections } from '@/components/home-cards/section-slot';
import { OpeningBalanceModal } from '@/components/opening-balance-modal';
import { QuickExpenseAddModal } from '@/components/quick-expense-add-modal';
import { useHomeData } from '@/hooks/use-home-data';
import { useHomeUI } from '@/hooks/use-home-ui';
import { useHomeCards } from '@/hooks/use-home-cards';
import { useHomeDerived } from '@/lib/home-derived';
import { useWeekTransition } from '@/hooks/use-week-transition';
import { WeekTransitionBottomSheet, WeekTransitionWizard } from '@/components/week-transition-wizard';
import { FlowSavingsModal } from '@/components/flow-savings-modal';

export default function HomePage() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();

  const data = useHomeData();
  const ui = useHomeUI();
  const cards = useHomeCards();

  const {
    budget, expenses, income, recipientCount, loading,
    householdMonthlyIncome, variableExpenseEstimate, investmentSettings,
    flowMonthlyBudget, flowMonthlySpent, flowScoreThreshold, flowStatusConfig, flowWeeklyStatus,
    sdsData, householdAdultCount, householdChildBirthYears, categoryGroupTypes, weeklyStreak,
    loadData, loadHousehold, setBudget, setUserRef, loadAll,
  } = data;

  const {
    showIncomeWizard, showFixedExpensesWizard, showVariableWizard,
    setShowIncomeWizard, setShowFixedExpensesWizard, setShowVariableWizard,
    markWhyWizardChecked, wizardEnabled,
  } = ui;

  const {
    cardVisibility, cardWidth, sortedCardKeys, togglingCard,
    loadCardConfigs, handleToggleCard,
  } = cards;

  const [openingBalanceInput, setOpeningBalanceInput] = useState('0');
  const [editingOpeningBalance, setEditingOpeningBalance] = useState(false);
  const [showQuickExpenseModal, setShowQuickExpenseModal] = useState(false);
  const homeScrollRef = useRef<HTMLDivElement>(null);
  const homeContentRef = useRef<HTMLDivElement>(null);
  const [needsBottomScrollSpace, setNeedsBottomScrollSpace] = useState(false);

  const derived = useHomeDerived({
    budget,
    income,
    expenses,
    householdMonthlyIncome,
    variableExpenseEstimate,
    investmentSettings,
    sdsData,
    householdAdultCount,
    householdChildBirthYears,
    recipientCount,
  });

  const weekTransition = useWeekTransition();

  useEffect(() => {
    setUserRef(user?.id);
  }, [user]);

  useEffect(() => {
    loadAll();
    loadCardConfigs();

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        loadAll();
        loadCardConfigs();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (!user) {
      markWhyWizardChecked();
      return;
    }
    setUserRef(user.id);
    loadHousehold();
  }, [user]);

  async function saveOpeningBalance() {
    if (!budget) return;
    const value = parseFloat(openingBalanceInput.replace(',', '.'));
    if (isNaN(value)) { toast.error('Ugyldig saldo'); return; }
    const { error } = await supabase.from('budgets').update({ opening_balance: value } as any).eq('id', budget.id);
    if (error) { toast.error('Kunne ikke gemme start saldo'); return; }
    setBudget(prev => prev ? { ...prev, opening_balance: value } : prev);
    setEditingOpeningBalance(false);
    toast.success('Start saldo gemt');
    loadData();
  }

  async function handleDismissOnboarding() {
    if (!budget) return;
    await supabase.from('budgets').update({ onboarding_dismissed: true } as any).eq('id', budget.id);
    setBudget(prev => prev ? { ...prev, onboarding_dismissed: true } : prev);
  }

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const color = 'rgb(236,253,245)';
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    document.body.style.backgroundColor = color;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
    return () => {
      document.body.style.backgroundColor = '';
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      if (meta) meta.content = '#f8f9f2';
    };
  }, []);

  useEffect(() => {
    const scroller = homeScrollRef.current;
    const content = homeContentRef.current;
    if (!scroller || !content) return;

    const measure = () => {
      const navReserve = 96;
      const style = window.getComputedStyle(content);
      const paddingBottom = parseFloat(style.paddingBottom || '0') || 0;
      const naturalContentHeight = content.scrollHeight - paddingBottom;
      setNeedsBottomScrollSpace(naturalContentHeight > scroller.clientHeight - navReserve);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    observer.observe(content);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [sortedCardKeys, cardVisibility, flowMonthlyBudget, flowMonthlySpent, weeklyStreak]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (!budget && wizardEnabled('wizard_enabled_onboarding')) {
    return <OnboardingIntro onComplete={() => { loadData(); router.push('/'); }} />;
  }

  const slotProps = {
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
    openingBalance: budget?.opening_balance ?? 0,
    wizardEnabled,
    onDismissOnboarding: handleDismissOnboarding,
    onShowIncomeWizard: () => setShowIncomeWizard(true),
    onShowFixedExpensesWizard: () => setShowFixedExpensesWizard(true),
    onShowVariableWizard: () => setShowVariableWizard(true),
    onShowStartBalance: () => {
      setOpeningBalanceInput(String(budget?.opening_balance ?? 0));
      setEditingOpeningBalance(true);
    },
    onShowQuickExpense: () => setShowQuickExpenseModal(true),
  };

  return (
    <HomeCardProvider
      isAdmin={isAdmin}
      cardVisibility={cardVisibility}
      togglingCard={togglingCard}
      onToggleCard={handleToggleCard}
    >
      <div
        className="h-[100dvh] min-h-[100dvh] overflow-hidden bg-gradient-to-b from-emerald-50/60 via-white to-white"
        style={{ backgroundColor: 'rgb(236,253,245)' }}
      >
        <div
          ref={homeScrollRef}
          className={`home-scroll h-full overscroll-none ${needsBottomScrollSpace ? 'overflow-y-auto' : 'overflow-hidden'}`}
        >
          <div
            ref={homeContentRef}
            className={`max-w-lg mx-auto px-4 sm:pb-16 ${needsBottomScrollSpace ? 'pb-28' : 'pb-4'}`}
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}
          >
            <div className="flex flex-col gap-4">
              <DynamicSections {...slotProps} sortedCardKeys={sortedCardKeys} cardWidth={cardWidth} />
            </div>
          </div>
        </div>
        <style jsx>{`
          .home-scroll {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }

          .home-scroll::-webkit-scrollbar {
            display: none;
          }
        `}</style>
      </div>

      {showIncomeWizard && budget && (
        <IncomeWizard
          onComplete={() => { setShowIncomeWizard(false); loadData(); }}
          onDismiss={() => setShowIncomeWizard(false)}
        />
      )}
      {showFixedExpensesWizard && budget && (
        <FixedExpensesWizard
          budgetId={budget.id}
          monthlyIncome={income / 12}
          onComplete={() => { setShowFixedExpensesWizard(false); loadData(); }}
          onDismiss={() => setShowFixedExpensesWizard(false)}
        />
      )}
      {showVariableWizard && (
        <VariableForbrugWizardModal
          onComplete={() => { setShowVariableWizard(false); loadData(); loadHousehold(); }}
          onDismiss={() => setShowVariableWizard(false)}
        />
      )}
      {showQuickExpenseModal && (
        <QuickExpenseAddModal
          onComplete={() => { setShowQuickExpenseModal(false); loadAll(); }}
          onDismiss={() => setShowQuickExpenseModal(false)}
        />
      )}
      {editingOpeningBalance && budget && (
        <OpeningBalanceModal
          value={openingBalanceInput}
          onChange={setOpeningBalanceInput}
          onSave={saveOpeningBalance}
          onClose={() => setEditingOpeningBalance(false)}
        />
      )}

      {weekTransition.showBottomSheet && weekTransition.summaryData && (
        <WeekTransitionBottomSheet
          summaryData={weekTransition.summaryData}
          dismissCount={weekTransition.dismissCount}
          onOpen={weekTransition.onOpenWizard}
          onDismiss={weekTransition.onDismiss}
        />
      )}

      {weekTransition.showWizard && weekTransition.summaryData && (
        <WeekTransitionWizard
          summaryData={weekTransition.summaryData}
          cachedAiSummary={weekTransition.cachedAiSummary}
          monthlySavings={weekTransition.monthlySavings}
          onAcknowledge={weekTransition.onAcknowledge}
          onDismiss={weekTransition.onDismiss}
          onExpenseAdded={weekTransition.recomputeSummary}
        />
      )}

      {weekTransition.showFlowSavingsModal && weekTransition.summaryData && (
        <FlowSavingsModal
          summaryData={weekTransition.summaryData}
          currentBalance={weekTransition.flowSavingsTotals?.current_balance ?? 0}
          lifetimeTotal={weekTransition.flowSavingsTotals?.lifetime_total ?? 0}
          weekCount={weekTransition.flowSavingsTotals?.week_count ?? 0}
          onConfirm={weekTransition.onFlowSavingsConfirm}
          onDismiss={weekTransition.onFlowSavingsDismiss}
        />
      )}
    </HomeCardProvider>
  );
}
