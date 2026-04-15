'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckupWizard } from '@/components/checkup-wizard';

export default function CheckupPage() {
  const router = useRouter();
  const [budgetId, setBudgetId] = useState<string | null>(null);
  const [lastCheckupAt, setLastCheckupAt] = useState<string | null>(null);
  const [checkupCount, setCheckupCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBudget();
  }, []);

  async function loadBudget() {
    try {
      const { data } = await supabase
        .from('budgets')
        .select('id, last_checkup_at, checkup_count')
        .eq('is_active', true)
        .maybeSingle();

      let budget: any = data;
      if (!budget) {
        const { data: fb } = await supabase
          .from('budgets')
          .select('id, last_checkup_at, checkup_count')
          .order('year', { ascending: false })
          .limit(1)
          .maybeSingle();
        budget = fb;
      }

      if (budget) {
        setBudgetId(budget.id);
        setLastCheckupAt(budget.last_checkup_at ?? null);
        setCheckupCount(budget.checkup_count ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!budgetId) {
    router.push('/budgets');
    return null;
  }

  return (
    <CheckupWizard
      budgetId={budgetId}
      lastCheckupAt={lastCheckupAt}
      checkupCount={checkupCount}
      onComplete={() => router.push('/')}
      onDismiss={() => router.back()}
    />
  );
}
