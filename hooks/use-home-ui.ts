'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUIStrings } from '@/lib/ui-strings-context';

export interface HomeUIState {
  showIncomeWizard: boolean;
  showFixedExpensesWizard: boolean;
  showVariableWizard: boolean;
  showWhyWizard: boolean;
  whyWizardChecked: boolean;
  showInfoModal: boolean;
}

export interface HomeUIActions {
  setShowIncomeWizard: (v: boolean) => void;
  setShowFixedExpensesWizard: (v: boolean) => void;
  setShowVariableWizard: (v: boolean) => void;
  setShowWhyWizard: (v: boolean) => void;
  setShowInfoModal: (v: boolean) => void;
  checkWhyWizard: (userId: string) => Promise<void>;
  markWhyWizardChecked: () => void;
  wizardEnabled: (key: string) => boolean;
}

export function useHomeUI(): HomeUIState & HomeUIActions {
  const { getString: getUiString } = useUIStrings();

  const [showIncomeWizard, setShowIncomeWizard] = useState(false);
  const [showFixedExpensesWizard, setShowFixedExpensesWizard] = useState(false);
  const [showVariableWizard, setShowVariableWizard] = useState(false);
  const [showWhyWizard, setShowWhyWizard] = useState(false);
  const [whyWizardChecked, setWhyWizardChecked] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  function wizardEnabled(key: string): boolean {
    return getUiString(key, 'true') === 'true';
  }

  async function checkWhyWizard(userId: string) {
    const { data } = await supabase
      .from('user_precision_commitment')
      .select('precision_mode')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data?.precision_mode && wizardEnabled('wizard_enabled_why')) {
      setShowWhyWizard(true);
    }
    setWhyWizardChecked(true);
  }

  function markWhyWizardChecked() {
    setWhyWizardChecked(true);
  }

  return {
    showIncomeWizard,
    showFixedExpensesWizard,
    showVariableWizard,
    showWhyWizard,
    whyWizardChecked,
    showInfoModal,
    setShowIncomeWizard,
    setShowFixedExpensesWizard,
    setShowVariableWizard,
    setShowWhyWizard,
    setShowInfoModal,
    checkWhyWizard,
    markWhyWizardChecked,
    wizardEnabled,
  };
}
