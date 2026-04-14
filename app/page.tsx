'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { OnboardingIntro } from '@/components/onboarding-intro';
import { WhyWizard } from '@/components/why-wizard';
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
import { getStartScreenHref } from '@/lib/start-screen';

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
    showWhyWizard,
    setShowIncomeWizard, setShowFixedExpensesWizard, setShowVariableWizard,
    setShowWhyWizard,
    checkWhyWizard, markWhyWizardChecked, wizardEnabled,
  } = ui;

  const {
    cardVisibility, cardWidth, sortedCardKeys, togglingCard,
    loadCardConfigs, handleToggleCard,
  } = cards;

  const [openingBalanceInput, setOpeningBalanceInput] = useState('0');
  const [editingOpeningBalance, setEditingOpeningBalance] = useState(false);
  const [showQuickExpenseModal, setShowQuickExpenseModal] = useState(false);

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

  useEffect(() => {
    setUserRef(user?.id);
  }, [user]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      const hasBeenRedirected = sessionStorage.getItem('nuvio_initial_redirect_done');
      if (!hasBeenRedirected) {
        sessionStorage.setItem('nuvio_initial_redirect_done', '1');
        router.replace(getStartScreenHref());
        return;
      }
    }

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
    checkWhyWizard(user.id);
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
    document.body.style.backgroundColor = color;
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
    return () => {
      document.body.style.backgroundColor = '';
      if (meta) meta.content = '#f8f9f2';
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (showWhyWizard && wizardEnabled('wizard_enabled_why')) {
    return <WhyWizard onComplete={() => setShowWhyWizard(false)} />;
  }

  if (!budget && wizardEnabled('wizard_enabled_onboarding')) {
    return <OnboardingIntro onComplete={() => router.push('/budgets')} />;
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
        className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-white"
        style={{ backgroundColor: 'rgb(236,253,245)' }}
      >
        <div
          className="max-w-lg mx-auto px-4 pb-32 sm:pb-16"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}
        >
          <div className="flex flex-col gap-4">
            <DynamicSections {...slotProps} sortedCardKeys={sortedCardKeys} cardWidth={cardWidth} />
          </div>
        </div>
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
    </HomeCardProvider>
  );
}
