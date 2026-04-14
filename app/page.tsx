'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Info, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { OnboardingIntro } from '@/components/onboarding-intro';
import { WhyWizard } from '@/components/why-wizard';
import { IncomeWizard } from '@/components/income-wizard';
import { FixedExpensesWizard } from '@/components/fixed-expenses-wizard';
import { VariableForbrugWizardModal } from '@/components/variable-forbrug-wizard-modal';
import { toast } from 'sonner';
import { EditableText } from '@/components/editable-text';
import { cn } from '@/lib/utils';
import { HomeCardProvider } from '@/components/home-cards/home-card-context';
import { DynamicSections } from '@/components/home-cards/section-slot';
import { OpeningBalanceModal } from '@/components/opening-balance-modal';
import { OverblikInfoModal } from '@/components/overblik-info-modal';
import { useHomeData } from '@/hooks/use-home-data';
import { useHomeUI } from '@/hooks/use-home-ui';
import { useHomeCards } from '@/hooks/use-home-cards';
import { useHomeDerived } from '@/lib/home-derived';

const DANISH_MONTHS = [
  'januar', 'februar', 'marts', 'april', 'maj', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'december',
];

export default function HomePage() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();

  const data = useHomeData();
  const ui = useHomeUI();
  const cards = useHomeCards();

  const {
    budget, expenses, income, recipientCount, loading,
    householdMonthlyIncome, variableExpenseEstimate, investmentSettings,
    sdsData, householdAdultCount, householdChildBirthYears, categoryGroupTypes, quickStreak,
    loadData, loadHousehold, setBudget, setUserRef, loadAll,
  } = data;

  const {
    showIncomeWizard, showFixedExpensesWizard, showVariableWizard,
    showWhyWizard, whyWizardChecked, showInfoModal,
    setShowIncomeWizard, setShowFixedExpensesWizard, setShowVariableWizard,
    setShowWhyWizard, setShowInfoModal,
    checkWhyWizard, markWhyWizardChecked, wizardEnabled,
  } = ui;

  const {
    cardVisibility, cardWidth, sortedCardKeys, togglingCard,
    loadCardConfigs, handleToggleCard,
  } = cards;

  const [openingBalanceInput, setOpeningBalanceInput] = useState('0');
  const [editingOpeningBalance, setEditingOpeningBalance] = useState(false);

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
        router.replace('/nuvio-flow');
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

  const now = new Date();
  const currentMonthName = DANISH_MONTHS[now.getMonth()];
  const currentYear = now.getFullYear();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (!whyWizardChecked) {
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
    quickStreak,
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
  };

  return (
    <HomeCardProvider
      isAdmin={isAdmin}
      cardVisibility={cardVisibility}
      togglingCard={togglingCard}
      onToggleCard={handleToggleCard}
    >
      <div className={cn('min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.18),transparent_28rem),linear-gradient(180deg,#f7fbfb_0%,#eef5f5_100%)] transition-colors duration-700', derived.pageBgClass)}>
        <div
          className="max-w-xl mx-auto px-4 pb-32 sm:pb-16"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}
        >
          <div className="mb-5 nuvio-card rounded-[8px] px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-2 rounded-[8px] nuvio-chip px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-emerald-600" />
                  {currentMonthName} {currentYear}
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                  <EditableText textKey="overblik.page.title" fallback="Overblik" as="span" />
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Dit økonomiske kompas for måneden.
                </p>
              </div>
              <button
                onClick={() => setShowInfoModal(true)}
                className="h-10 w-10 rounded-[8px] border border-emerald-300/70 bg-white/80 flex items-center justify-center text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50 transition-all duration-200 shadow-sm shrink-0"
                aria-label="Om Overblik"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
          </div>

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

      {showInfoModal && <OverblikInfoModal onClose={() => setShowInfoModal(false)} />}

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
