'use client';

import { useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

import { WhyWizard } from '@/components/why-wizard';
import { OnboardingIntro } from '@/components/onboarding-intro';
import { IncomeWizard } from '@/components/income-wizard';
import { HouseholdWizard } from '@/components/household-wizard';
import { InvestmentWizard } from '@/components/investment-wizard';
import { BudgetSetupWizard } from '@/components/budget-setup-wizard';
import { FixedExpensesWizard } from '@/components/fixed-expenses-wizard';
import { VariableExpenseWizard } from '@/components/variable-expense-wizard';
import { VariableForbrugWizardModal } from '@/components/variable-forbrug-wizard-modal';
import { CheckupWizard } from '@/components/checkup-wizard';
import UserDataResetWizard from '@/components/user-data-reset-wizard';
import { useUIStrings } from '@/lib/ui-strings-context';

type WizardId =
  | 'why'
  | 'onboarding'
  | 'income'
  | 'household'
  | 'investment'
  | 'budget-setup'
  | 'fixed-expenses'
  | 'variable-expenses'
  | 'variable-forbrug'
  | 'checkup'
  | 'data-reset';

interface WizardMeta {
  id: WizardId;
  title: string;
  description: string;
  badge: string;
  badgeColor: string;
  steps?: number;
  enabledKey: string;
}

const WIZARDS: WizardMeta[] = [
  {
    id: 'why',
    title: 'Why Wizard',
    description: 'Nuvios rådgiverløfte — forklarer præcisionsprincippet og indhenter brugerens accept.',
    badge: '5 trin',
    badgeColor: 'bg-emerald-100 text-emerald-700',
    steps: 5,
    enabledKey: 'wizard_enabled_why',
  },
  {
    id: 'onboarding',
    title: 'Onboarding Intro',
    description: 'Første møde med Nuvio — sætter brugeren op med mål og husstandsinfo.',
    badge: 'Intro',
    badgeColor: 'bg-teal-100 text-teal-700',
    enabledKey: 'wizard_enabled_onboarding',
  },
  {
    id: 'income',
    title: 'Indkomst Wizard',
    description: 'Guider brugeren til at registrere deres indkomstkilder korrekt.',
    badge: '2 trin',
    badgeColor: 'bg-blue-100 text-blue-700',
    steps: 2,
    enabledKey: 'wizard_enabled_income',
  },
  {
    id: 'household',
    title: 'Husstand Wizard',
    description: 'Opsætning af husstandsstørrelse, boligtype, børn og postnummer.',
    badge: '5 trin',
    badgeColor: 'bg-amber-100 text-amber-700',
    steps: 5,
    enabledKey: 'wizard_enabled_household',
  },
  {
    id: 'investment',
    title: 'Investering Wizard',
    description: 'Kortlægger investeringsparathed, beløb, tidshorisont og risikoappetit.',
    badge: '6 trin',
    badgeColor: 'bg-violet-100 text-violet-700',
    steps: 6,
    enabledKey: 'wizard_enabled_investment',
  },
  {
    id: 'budget-setup',
    title: 'Budget Opsætning',
    description: 'Opretter et nyt budget — vælger startmetode, udgifter og bufferniveau.',
    badge: '5 trin',
    badgeColor: 'bg-sky-100 text-sky-700',
    steps: 5,
    enabledKey: 'wizard_enabled_budget_setup',
  },
  {
    id: 'fixed-expenses',
    title: 'Faste Udgifter Wizard',
    description: 'Registrerer og validerer alle faste månedlige udgifter baseret på boligtype.',
    badge: '5 trin',
    badgeColor: 'bg-orange-100 text-orange-700',
    steps: 5,
    enabledKey: 'wizard_enabled_fixed_expenses',
  },
  {
    id: 'variable-expenses',
    title: 'Variable Udgifter Wizard',
    description: 'Estimerer variable udgifter via sliders med realitetstjek.',
    badge: '3 trin',
    badgeColor: 'bg-pink-100 text-pink-700',
    steps: 3,
    enabledKey: 'wizard_enabled_variable_expenses',
  },
  {
    id: 'variable-forbrug',
    title: 'Variable Forbrug Beregner',
    description: 'Beregner forventet variabelt forbrug baseret på husstand og postnummer.',
    badge: '4 trin',
    badgeColor: 'bg-rose-100 text-rose-700',
    steps: 4,
    enabledKey: 'wizard_enabled_variable_forbrug',
  },
  {
    id: 'checkup',
    title: 'Budget Checkup',
    description: 'Månedlig gennemgang af budget — indkomst, udgifter, opsparing og investering.',
    badge: '7 trin',
    badgeColor: 'bg-cyan-100 text-cyan-700',
    steps: 7,
    enabledKey: 'wizard_enabled_checkup',
  },
  {
    id: 'data-reset',
    title: 'Nulstil Mine Data',
    description: 'Lader brugeren nulstille specifikke sektioner af deres data.',
    badge: 'Admin',
    badgeColor: 'bg-red-100 text-red-700',
    enabledKey: 'wizard_enabled_data_reset',
  },
];

const DEMO_BUDGET_ID = 'preview-budget-id';
const DEMO_INCOME = 45000;
const DEMO_ADULTS = 2;

export default function AdminWizardsPage() {
  const [active, setActive] = useState<WizardId | null>(null);
  const { getString, updateString, loaded } = useUIStrings();
  const [saving, setSaving] = useState<string | null>(null);

  function isEnabled(key: string): boolean {
    return getString(key, 'true') === 'true';
  }

  async function toggleWizard(key: string, current: boolean) {
    setSaving(key);
    try {
      await updateString(key, current ? 'false' : 'true');
    } finally {
      setSaving(null);
    }
  }

  function close() {
    setActive(null);
  }

  if (active === 'why') {
    return <WhyWizard onComplete={close} />;
  }

  if (active === 'onboarding') {
    return <OnboardingIntro onComplete={close} />;
  }

  if (active === 'income') {
    return <IncomeWizard onComplete={close} onDismiss={close} />;
  }

  if (active === 'household') {
    return <HouseholdWizard onComplete={close} onDismiss={close} />;
  }

  if (active === 'investment') {
    return <InvestmentWizard onComplete={close} />;
  }

  if (active === 'budget-setup') {
    return (
      <BudgetSetupWizard
        adults={DEMO_ADULTS}
        monthlyIncome={DEMO_INCOME}
        onComplete={close}
        onStartVariableWizard={close}
      />
    );
  }

  if (active === 'fixed-expenses') {
    return (
      <FixedExpensesWizard
        budgetId={DEMO_BUDGET_ID}
        monthlyIncome={DEMO_INCOME}
        adults={DEMO_ADULTS}
        childCount={0}
        onComplete={close}
        onDismiss={close}
      />
    );
  }

  if (active === 'variable-expenses') {
    return (
      <VariableExpenseWizard
        budgetId={DEMO_BUDGET_ID}
        monthlyIncome={DEMO_INCOME}
        fixedExpenses={15000}
        onComplete={close}
        onDismiss={close}
      />
    );
  }

  if (active === 'variable-forbrug') {
    return <VariableForbrugWizardModal onComplete={close} onDismiss={close} />;
  }

  if (active === 'checkup') {
    return (
      <CheckupWizard
        budgetId={DEMO_BUDGET_ID}
        onComplete={close}
        onDismiss={close}
      />
    );
  }

  if (active === 'data-reset') {
    return (
      <div className="fixed inset-0 z-[80] bg-gradient-to-b from-emerald-50/60 via-white to-white overflow-y-auto">
        <div className="max-w-lg mx-auto px-5 py-10">
          <UserDataResetWizard />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-white py-10 px-6">
      <div className="max-w-4xl mx-auto space-y-8">

        <div className="space-y-1">
          <p className="text-label font-semibold uppercase tracking-widest text-emerald-600/70">
            Admin
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Wizards</h1>
          <p className="text-sm text-muted-foreground">
            Preview og test alle onboarding- og opsætningswizards. Brug togglen til at slå wizards til eller fra for brugere.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {WIZARDS.map((w) => {
            const enabled = isEnabled(w.enabledKey);
            const isSaving = saving === w.enabledKey;
            return (
              <Card
                key={w.id}
                className={`rounded-2xl border shadow-sm bg-white/80 backdrop-blur hover:shadow-md transition-all ${
                  enabled ? 'border-border/60' : 'border-border/30 opacity-60'
                }`}
              >
                <CardHeader className="pb-2 pt-5 px-5">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold leading-tight">
                      {w.title}
                    </CardTitle>
                    <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${w.badgeColor}`}>
                      {w.badge}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-4">
                  <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                    {w.description}
                  </CardDescription>

                  <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-muted/40 border border-border/30">
                    <span className={`text-xs font-medium ${enabled ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                      {enabled ? 'Aktiveret for brugere' : 'Skjult for brugere'}
                    </span>
                    <Switch
                      checked={enabled}
                      disabled={!loaded || isSaving}
                      onCheckedChange={() => toggleWizard(w.enabledKey, enabled)}
                    />
                  </div>

                  <Button
                    size="sm"
                    className="w-full h-9 rounded-xl text-xs font-semibold gap-2"
                    onClick={() => setActive(w.id)}
                  >
                    <Play className="h-3.5 w-3.5" />
                    Start preview
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-4">
          <p className="text-xs font-semibold text-amber-700 mb-1">Preview-tilstand</p>
          <p className="text-xs text-amber-600/80 leading-relaxed">
            Wizards der kræver et budget-ID kører med demo-værdier (indkomst: 45.000 kr/md, voksne: 2).
            Handlinger der skriver til databasen vil stadig gemme data — vær opmærksom ved test.
          </p>
        </div>

      </div>
    </div>
  );
}
