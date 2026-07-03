'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
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
import { WeeklyBudgetReminderModal } from '@/components/weekly-budget-reminder-modal';
import { WeekBudgetSetupModal } from '@/components/week-budget-setup-modal';
import { MonthCloseReminderModal } from '@/components/month-close-reminder-modal';
import { ScoreDropReminderModal } from '@/components/score-drop-reminder-modal';
import { ScoreStrongReminderModal } from '@/components/score-strong-reminder-modal';
import { GoodGripReminderModal } from '@/components/good-grip-reminder-modal';
import { HonestEntriesReminderModal } from '@/components/honest-entries-reminder-modal';
import { SingleAccountMethodReminderModal } from '@/components/single-account-method-reminder-modal';
import { KUVERT_HOME_VARIANT } from '@/lib/kuvert-home-variant';
import { VacationModeWizard } from '@/components/vacation-mode-wizard';
import { VacationModeActivationFlow } from '@/components/vacation-mode-activation-flow';
import { VacationModeCompletionFlow } from '@/components/vacation-mode-completion-flow';
import {
  getReadyVacationMode,
  isVacationModeReadyToEnd,
  type VacationMode,
} from '@/lib/vacation-mode-service';
import { getQuickExpensesForRange, type QuickExpense } from '@/lib/quick-expense-service';
import { useSettings } from '@/lib/settings-context';
import { getVacationAccentColor, withAlpha } from '@/lib/vacation-theme';
import { useVacationMode } from '@/lib/vacation-mode-context';

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { design } = useSettings();
  const {
    activeVacationMode,
    plannedVacationMode,
    isResolved: vacationModeResolved,
    refreshVacationMode,
  } = useVacationMode();

  const data = useHomeData();
  const ui = useHomeUI();
  const cards = useHomeCards();

  const {
    budget, expenses, income, recipientCount, loading,
    householdMonthlyIncome, variableExpenseEstimate, investmentSettings,
    flowMonthlyBudget, flowMonthlySpent, flowScoreThreshold, flowStatusConfig, flowWeeklyStatus,
    sdsData, householdAdultCount, householdChildBirthYears, categoryGroupTypes, quickStreak, weeklyStreak, quickExpenses,
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
  const [showWeeklyBudgetReminder, setShowWeeklyBudgetReminder] = useState(false);
  const [showWeekBudgetSetup, setShowWeekBudgetSetup] = useState(false);
  const [showMonthCloseReminder, setShowMonthCloseReminder] = useState(false);
  const [showScoreDropReminder, setShowScoreDropReminder] = useState(false);
  const [showScoreStrongReminder, setShowScoreStrongReminder] = useState(false);
  const [showGoodGripReminder, setShowGoodGripReminder] = useState(false);
  const [showHonestEntriesReminder, setShowHonestEntriesReminder] = useState(false);
  const [showSingleAccountMethodReminder, setShowSingleAccountMethodReminder] = useState(false);
  const [showVacationWizard, setShowVacationWizard] = useState(false);
  const [vacationModeToEdit, setVacationModeToEdit] = useState<VacationMode | null>(null);
  const [vacationQuickExpenses, setVacationQuickExpenses] = useState<QuickExpense[]>([]);
  const [readyVacationMode, setReadyVacationMode] = useState<VacationMode | null>(null);
  const [showVacationActivation, setShowVacationActivation] = useState(false);
  const [vacationActivationDismissed, setVacationActivationDismissed] = useState(false);
  const [showVacationCompletion, setShowVacationCompletion] = useState(false);
  const [vacationCompletionDismissed, setVacationCompletionDismissed] = useState(false);
  const [weeklyReminderMode, setWeeklyReminderMode] = useState<'weekly-budget-reminder' | 'weekly-budget-low' | 'streak-risk'>('weekly-budget-reminder');
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
  const currentWeekReminder = useMemo(
    () => flowWeeklyStatus?.weeks.find((week) => week.isCurrentWeek) ?? null,
    [flowWeeklyStatus]
  );
  const vacationAccent = useMemo(() => getVacationAccentColor(design), [design]);
  const pageBackground = useMemo(() => {
    if (activeVacationMode) {
      const top = withAlpha(vacationAccent, 0.16);
      return {
        top,
        gradient: `linear-gradient(to bottom, ${top}, rgba(255,252,243,0.88), #ffffff)`,
      };
    }
    return {
      top: 'rgb(236,253,245)',
      gradient: 'linear-gradient(to bottom, rgba(236,253,245,0.95), rgba(255,255,255,0.92), #ffffff)',
    };
  }, [activeVacationMode, vacationAccent]);
  const topBgColor = pageBackground.top;

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
      setVacationQuickExpenses([]);
      setReadyVacationMode(null);
      setShowVacationActivation(false);
      setShowVacationCompletion(false);
      return;
    }
    setUserRef(user.id);
    loadHousehold();
  }, [user]);

  async function loadReadyVacationMode({ forceOpen = false } = {}) {
    if (!user) return;
    try {
      const readyMode = await getReadyVacationMode(user.id);
      setReadyVacationMode(readyMode);
      if (readyMode && (forceOpen || !vacationActivationDismissed)) {
        setShowVacationActivation(true);
      }
    } catch (error) {
      console.warn('Kunne ikke hente klar feriekuvert', error);
    }
  }

  useEffect(() => {
    setVacationActivationDismissed(false);
    setVacationCompletionDismissed(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user || loading || showVacationWizard) return;
    loadReadyVacationMode();
  }, [user?.id, loading, showVacationWizard]);

  useEffect(() => {
    let cancelled = false;

    async function loadVacationQuickExpenses() {
      if (!activeVacationMode) {
        setVacationQuickExpenses([]);
        setShowVacationCompletion(false);
        return;
      }

      try {
        const expenses = await getQuickExpensesForRange(
          activeVacationMode.start_date,
          activeVacationMode.end_date,
          'vacation'
        );
        if (!cancelled) {
          setVacationQuickExpenses(expenses);
          if (isVacationModeReadyToEnd(activeVacationMode) && !vacationCompletionDismissed) {
            setShowVacationCompletion(true);
          }
        }
      } catch (error) {
        console.warn('Kunne ikke hente ferieudgifter', error);
        if (!cancelled) {
          setVacationQuickExpenses([]);
          setShowVacationCompletion(false);
        }
      }
    }

    loadVacationQuickExpenses();

    return () => {
      cancelled = true;
    };
  }, [activeVacationMode, vacationCompletionDismissed]);

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
    const color = topBgColor;
    const previousHtmlBackground = document.documentElement.style.backgroundColor;
    const previousBodyBackground = document.body.style.backgroundColor;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    document.body.style.backgroundColor = color;
    document.documentElement.style.backgroundColor = color;
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
      document.body.style.backgroundColor = previousBodyBackground;
      document.documentElement.style.backgroundColor = previousHtmlBackground;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      if (meta) meta.content = '#f8f9f2';
    };
  }, [topBgColor]);

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

  useEffect(() => {
    if (loading) return;
    const flow = searchParams.get('flow');
    if ((flow === 'weekly-budget-reminder' || flow === 'weekly-budget-low' || flow === 'streak-risk') && currentWeekReminder) {
      setWeeklyReminderMode(
        flow === 'streak-risk'
          ? 'streak-risk'
          : flow === 'weekly-budget-low'
            ? 'weekly-budget-low'
            : 'weekly-budget-reminder'
      );
      setShowWeeklyBudgetReminder(true);
    }
    if (flow === 'week-budget-setup') {
      setShowWeekBudgetSetup(true);
    }
    if (flow === 'month-close' && flowMonthlyBudget > 0) {
      setShowMonthCloseReminder(true);
    }
    if (flow === 'score-drop' && flowMonthlyBudget > 0) {
      setShowScoreDropReminder(true);
    }
    if (flow === 'score-strong' && flowMonthlyBudget > 0) {
      setShowScoreStrongReminder(true);
    }
    if (flow === 'good-grip' && flowMonthlyBudget > 0) {
      setShowGoodGripReminder(true);
    }
    if (flow === 'honest-entries') {
      setShowHonestEntriesReminder(true);
    }
    if (flow === 'single-account-method') {
      setShowSingleAccountMethodReminder(true);
    }
    if (
      flow === 'week-transition' &&
      weekTransition.summaryData &&
      !weekTransition.showBottomSheet &&
      !weekTransition.showWizard
    ) {
      weekTransition.openBottomSheet();
    }
    if (
      flow === 'flow-savings' &&
      weekTransition.summaryData &&
      !weekTransition.showFlowSavingsModal
    ) {
      weekTransition.openFlowSavingsModal();
    }
  }, [
    currentWeekReminder,
    flowMonthlyBudget,
    loading,
    searchParams,
    weekTransition.summaryData,
    weekTransition.showBottomSheet,
    weekTransition.showFlowSavingsModal,
    weekTransition.showWizard,
  ]);

  function clearReminderQuery() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('flow');
    const query = next.toString();
    router.replace(query ? `/?${query}` : '/', { scroll: false });
  }

  function dismissWeeklyReminder() {
    setShowWeeklyBudgetReminder(false);
    clearReminderQuery();
  }

  function dismissWeekBudgetSetup() {
    setShowWeekBudgetSetup(false);
    clearReminderQuery();
  }

  function completeWeekBudgetSetup() {
    setShowWeekBudgetSetup(false);
    clearReminderQuery();
    loadAll();
  }

  function dismissMonthCloseReminder() {
    setShowMonthCloseReminder(false);
    clearReminderQuery();
  }

  function dismissScoreDropReminder() {
    setShowScoreDropReminder(false);
    clearReminderQuery();
  }

  function dismissScoreStrongReminder() {
    setShowScoreStrongReminder(false);
    clearReminderQuery();
  }

  function dismissGoodGripReminder() {
    setShowGoodGripReminder(false);
    clearReminderQuery();
  }

  function dismissHonestEntriesReminder() {
    setShowHonestEntriesReminder(false);
    clearReminderQuery();
  }

  function dismissSingleAccountMethodReminder() {
    setShowSingleAccountMethodReminder(false);
    clearReminderQuery();
  }

  function openQuickExpenseFromReminder() {
    setShowWeeklyBudgetReminder(false);
    clearReminderQuery();
    setShowQuickExpenseModal(true);
  }

  function dismissWeekTransition() {
    weekTransition.onDismiss();
    clearReminderQuery();
  }

  async function acknowledgeWeekTransition(aiSummary: string | null) {
    await weekTransition.onAcknowledge(aiSummary);
    clearReminderQuery();
  }

  function dismissFlowSavingsModal() {
    weekTransition.onFlowSavingsDismiss();
    clearReminderQuery();
  }

  async function confirmFlowSavingsModal() {
    await weekTransition.onFlowSavingsConfirm();
    clearReminderQuery();
  }

  function dismissVacationActivation() {
    setShowVacationActivation(false);
    setVacationActivationDismissed(true);
  }

  function openVacationWizard(mode: VacationMode | null = null) {
    setVacationModeToEdit(mode);
    setShowVacationWizard(true);
    setShowVacationActivation(false);
  }

  function completeVacationActivation() {
    setShowVacationActivation(false);
    setReadyVacationMode(null);
    setVacationActivationDismissed(false);
    loadAll();
    refreshVacationMode();
  }

  function openVacationCompletion() {
    if (!activeVacationMode) return;
    setShowVacationCompletion(true);
  }

  function dismissVacationCompletion() {
    setShowVacationCompletion(false);
    setVacationCompletionDismissed(true);
  }

  function completeVacationCompletion() {
    setShowVacationCompletion(false);
    setVacationCompletionDismissed(false);
    setVacationQuickExpenses([]);
    loadAll();
    refreshVacationMode();
  }

  function handleQuickExpenseSaved() {
    loadAll();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (user && authLoading) {
    return null;
  }

  if (user && !vacationModeResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  const slotProps = {
    isAdmin,
    cardVisibility,
    derived,
    categoryGroupTypes,
    recipientCount,
    quickStreak,
    weeklyStreak,
    quickExpenses: activeVacationMode ? vacationQuickExpenses : quickExpenses,
    vacationMode: activeVacationMode,
    plannedVacationMode,
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
    onQuickExpenseSaved: handleQuickExpenseSaved,
    onPlanVacation: () => openVacationWizard(),
    onEndVacation: activeVacationMode ? openVacationCompletion : undefined,
    heroVariant: KUVERT_HOME_VARIANT,
  };

  return (
    <HomeCardProvider
      isAdmin={isAdmin}
      cardVisibility={cardVisibility}
      togglingCard={togglingCard}
      onToggleCard={handleToggleCard}
    >
      <div
        className="h-[100dvh] min-h-[100dvh] overflow-hidden"
        style={{ background: pageBackground.gradient, backgroundColor: topBgColor }}
      >
        <div
          ref={homeScrollRef}
          className={`home-scroll h-full overscroll-none ${needsBottomScrollSpace ? 'overflow-y-auto' : 'overflow-hidden'}`}
        >
          <div
            ref={homeContentRef}
            className={`max-w-lg mx-auto px-4 sm:pb-16 ${needsBottomScrollSpace ? 'pb-24' : 'pb-3'}`}
            style={{ paddingTop: 'max(calc(env(safe-area-inset-top) + 0.55rem), 1.7rem)' }}
          >
            <div className="flex flex-col gap-2 sm:gap-4">
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
      {showWeeklyBudgetReminder && currentWeekReminder && (
        <WeeklyBudgetReminderModal
          week={currentWeekReminder}
          weeklyStreak={weeklyStreak}
          mode={weeklyReminderMode}
          onClose={dismissWeeklyReminder}
          onAddExpense={openQuickExpenseFromReminder}
        />
      )}
      <VacationModeWizard
        open={showVacationWizard}
        onClose={() => { setShowVacationWizard(false); setVacationModeToEdit(null); }}
        vacationMode={vacationModeToEdit}
        onSaved={() => {
          loadAll();
          loadReadyVacationMode({ forceOpen: true });
          refreshVacationMode();
        }}
      />
      <VacationModeActivationFlow
        open={showVacationActivation}
        vacationMode={readyVacationMode}
        onClose={dismissVacationActivation}
        onActivated={completeVacationActivation}
        onNeedsBudget={() => openVacationWizard(readyVacationMode)}
      />
      <VacationModeCompletionFlow
        open={showVacationCompletion}
        vacationMode={activeVacationMode}
        expenses={vacationQuickExpenses}
        onClose={dismissVacationCompletion}
        onCompleted={completeVacationCompletion}
      />
      {showWeekBudgetSetup && (
        <WeekBudgetSetupModal
          currentBudget={flowMonthlyBudget}
          onClose={dismissWeekBudgetSetup}
          onSaved={completeWeekBudgetSetup}
        />
      )}
      {showMonthCloseReminder && flowMonthlyBudget > 0 && (
        <MonthCloseReminderModal
          monthlyBudget={flowMonthlyBudget}
          monthlySpent={flowMonthlySpent}
          scoreThreshold={flowScoreThreshold}
          carryOverPenalty={Math.abs(Math.min(0, flowWeeklyStatus?.accumulatedCarryOver ?? 0))}
          onClose={dismissMonthCloseReminder}
          onAddExpense={openQuickExpenseFromReminder}
        />
      )}
      {showScoreDropReminder && flowMonthlyBudget > 0 && (
        <ScoreDropReminderModal
          monthlyBudget={flowMonthlyBudget}
          monthlySpent={flowMonthlySpent}
          scoreThreshold={flowScoreThreshold}
          carryOverPenalty={Math.abs(Math.min(0, flowWeeklyStatus?.accumulatedCarryOver ?? 0))}
          onClose={dismissScoreDropReminder}
          onAddExpense={openQuickExpenseFromReminder}
        />
      )}
      {showScoreStrongReminder && flowMonthlyBudget > 0 && (
        <ScoreStrongReminderModal
          monthlyBudget={flowMonthlyBudget}
          monthlySpent={flowMonthlySpent}
          scoreThreshold={flowScoreThreshold}
          carryOverPenalty={Math.abs(Math.min(0, flowWeeklyStatus?.accumulatedCarryOver ?? 0))}
          onClose={dismissScoreStrongReminder}
          onAddExpense={openQuickExpenseFromReminder}
        />
      )}
      {showGoodGripReminder && flowMonthlyBudget > 0 && (
        <GoodGripReminderModal
          monthlyBudget={flowMonthlyBudget}
          monthlySpent={flowMonthlySpent}
          scoreThreshold={flowScoreThreshold}
          carryOverPenalty={Math.abs(Math.min(0, flowWeeklyStatus?.accumulatedCarryOver ?? 0))}
          onClose={dismissGoodGripReminder}
          onAddExpense={openQuickExpenseFromReminder}
        />
      )}
      {showHonestEntriesReminder && (
        <HonestEntriesReminderModal
          onClose={dismissHonestEntriesReminder}
          onAddExpense={openQuickExpenseFromReminder}
        />
      )}
      {showSingleAccountMethodReminder && (
        <SingleAccountMethodReminderModal
          onClose={dismissSingleAccountMethodReminder}
          onAddExpense={openQuickExpenseFromReminder}
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
          onDismiss={dismissWeekTransition}
        />
      )}

      {weekTransition.showWizard && weekTransition.summaryData && (
        <WeekTransitionWizard
          summaryData={weekTransition.summaryData}
          cachedAiSummary={weekTransition.cachedAiSummary}
          monthlySavings={weekTransition.monthlySavings}
          onAcknowledge={acknowledgeWeekTransition}
          onDismiss={dismissWeekTransition}
          onExpenseAdded={weekTransition.recomputeSummary}
        />
      )}

      {weekTransition.showFlowSavingsModal && weekTransition.summaryData && (
        <FlowSavingsModal
          summaryData={weekTransition.summaryData}
          currentBalance={weekTransition.flowSavingsTotals?.current_balance ?? 0}
          lifetimeTotal={weekTransition.flowSavingsTotals?.lifetime_total ?? 0}
          weekCount={weekTransition.flowSavingsTotals?.week_count ?? 0}
          onConfirm={confirmFlowSavingsModal}
          onDismiss={dismissFlowSavingsModal}
        />
      )}
    </HomeCardProvider>
  );
}
