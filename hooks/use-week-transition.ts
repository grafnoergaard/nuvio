'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  getPreviousWeekInfo,
  computeWeekSummaryData,
  getWeekTransition,
  upsertWeekTransition,
  acknowledgeWeekTransition,
  saveAiSummary,
  incrementDismissCount,
  getMonthlyAccumulatedSavings,
  type WeekSummaryData,
} from '@/lib/week-transition-service';
import {
  getQuickExpensesForMonth,
  getMonthlyBudget,
  getUserWeekStartDay,
} from '@/lib/quick-expense-service';
import {
  hasFlowSavingsEntryForWeek,
  getFlowSavingsTotals,
  recordFlowSavingsWeek,
  type FlowSavingsTotals,
} from '@/lib/flow-savings-service';

interface UseWeekTransitionResult {
  showBottomSheet: boolean;
  showWizard: boolean;
  showFlowSavingsModal: boolean;
  summaryData: WeekSummaryData | null;
  cachedAiSummary: string | null;
  accessToken: string | null;
  dismissCount: number;
  monthlySavings: number;
  flowSavingsTotals: FlowSavingsTotals | null;
  onOpenWizard: () => void;
  onAcknowledge: (aiSummary: string | null) => Promise<void>;
  onDismiss: () => void;
  onFlowSavingsConfirm: () => Promise<void>;
  onFlowSavingsDismiss: () => void;
  recomputeSummary: () => Promise<WeekSummaryData>;
}

export function useWeekTransition(): UseWeekTransitionResult {
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showFlowSavingsModal, setShowFlowSavingsModal] = useState(false);
  const [summaryData, setSummaryData] = useState<WeekSummaryData | null>(null);
  const [cachedAiSummary, setCachedAiSummary] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [dismissCount, setDismissCount] = useState(0);
  const [monthlySavings, setMonthlySavings] = useState(0);
  const [flowSavingsTotals, setFlowSavingsTotals] = useState<FlowSavingsTotals | null>(null);
  const evaluatedRef = useRef(false);

  const pendingTransitionRef = useRef<{
    year: number;
    month: number;
    weekNumber: number;
  } | null>(null);

  useEffect(() => {
    if (evaluatedRef.current) return;
    evaluatedRef.current = true;
    evaluate();
  }, []);

  async function evaluate() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setAccessToken(session.access_token);

      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;

      const weekStartDay = await getUserWeekStartDay();
      const prevWeekInfo = getPreviousWeekInfo(year, month, today, weekStartDay);

      if (!prevWeekInfo) return;

      const alreadyAcknowledged = await checkAcknowledged(
        prevWeekInfo.year,
        prevWeekInfo.month,
        prevWeekInfo.weekNumber
      );
      if (alreadyAcknowledged) return;

      const [expenses, monthlyBudget] = await Promise.all([
        getQuickExpensesForMonth(prevWeekInfo.year, prevWeekInfo.month),
        getMonthlyBudget(prevWeekInfo.year, prevWeekInfo.month),
      ]);

      if (!monthlyBudget || monthlyBudget.budget_amount <= 0) return;

      const data = await computeWeekSummaryData(
        prevWeekInfo.year,
        prevWeekInfo.month,
        prevWeekInfo.weekNumber,
        prevWeekInfo.weekStart,
        prevWeekInfo.weekEnd,
        expenses,
        monthlyBudget,
        weekStartDay
      );

      await upsertWeekTransition(
        data.year,
        data.month,
        data.weekNumber,
        data.budgetAmount,
        data.totalSpent,
        data.carryOver,
        data.transactionCount
      );

      const existing = await getWeekTransition(data.year, data.month, data.weekNumber);
      const cached = existing?.ai_summary ?? null;
      const currentDismissCount = existing?.dismiss_count ?? 0;

      const accumulated = await getMonthlyAccumulatedSavings(data.year, data.month);
      const currentFlowTotals = await getFlowSavingsTotals();

      pendingTransitionRef.current = {
        year: data.year,
        month: data.month,
        weekNumber: data.weekNumber,
      };

      setSummaryData(data);
      setCachedAiSummary(cached);
      setDismissCount(currentDismissCount);
      setMonthlySavings(accumulated);
      setFlowSavingsTotals(currentFlowTotals);

      setTimeout(() => setShowBottomSheet(true), 800);
    } catch {
    }
  }

  async function checkAcknowledged(year: number, month: number, weekNumber: number): Promise<boolean> {
    try {
      const existing = await getWeekTransition(year, month, weekNumber);
      return existing !== null && existing.acknowledged_at !== null;
    } catch {
      return false;
    }
  }

  function onOpenWizard() {
    setShowBottomSheet(false);
    setShowWizard(true);
  }

  async function onAcknowledge(aiSummary: string | null) {
    const pending = pendingTransitionRef.current;
    if (!pending) {
      setShowWizard(false);
      setShowBottomSheet(false);
      return;
    }

    try {
      if (aiSummary) {
        await saveAiSummary(pending.year, pending.month, pending.weekNumber, aiSummary);
      }
      await acknowledgeWeekTransition(pending.year, pending.month, pending.weekNumber);
    } catch {
    } finally {
      setShowWizard(false);
      setShowBottomSheet(false);
    }

    try {
      const alreadyRecorded = await hasFlowSavingsEntryForWeek(
        pending.year,
        pending.month,
        pending.weekNumber
      );
      if (!alreadyRecorded) {
        setTimeout(() => setShowFlowSavingsModal(true), 400);
      }
    } catch {
    }
  }

  async function onDismiss() {
    const pending = pendingTransitionRef.current;
    if (pending) {
      try {
        const newCount = await incrementDismissCount(pending.year, pending.month, pending.weekNumber);
        setDismissCount(newCount);

        if (newCount >= 2) {
          await acknowledgeWeekTransition(pending.year, pending.month, pending.weekNumber);
        }
      } catch {
      }
    }
    setShowBottomSheet(false);
    setShowWizard(false);
  }

  async function onFlowSavingsConfirm() {
    const pending = pendingTransitionRef.current;
    if (!pending || !summaryData) {
      setShowFlowSavingsModal(false);
      return;
    }
    try {
      const carryOver = summaryData.budgetAmount - summaryData.totalSpent;
      const { totals } = await recordFlowSavingsWeek(
        pending.year,
        pending.month,
        pending.weekNumber,
        carryOver,
        summaryData.budgetAmount,
        summaryData.totalSpent
      );
      setFlowSavingsTotals(totals);
    } catch {
    } finally {
      setShowFlowSavingsModal(false);
    }
  }

  function onFlowSavingsDismiss() {
    setShowFlowSavingsModal(false);
  }

  async function recomputeSummary(): Promise<WeekSummaryData> {
    const pending = pendingTransitionRef.current;
    if (!pending) throw new Error('No pending transition');

    const today = new Date();
    const weekStartDay = await getUserWeekStartDay();
    const prevWeekInfo = getPreviousWeekInfo(
      today.getFullYear(),
      today.getMonth() + 1,
      today,
      weekStartDay
    );
    if (!prevWeekInfo) throw new Error('No previous week info');

    const [expenses, monthlyBudget] = await Promise.all([
      getQuickExpensesForMonth(prevWeekInfo.year, prevWeekInfo.month),
      getMonthlyBudget(prevWeekInfo.year, prevWeekInfo.month),
    ]);

    const updated = await computeWeekSummaryData(
      prevWeekInfo.year,
      prevWeekInfo.month,
      prevWeekInfo.weekNumber,
      prevWeekInfo.weekStart,
      prevWeekInfo.weekEnd,
      expenses,
      monthlyBudget,
      weekStartDay
    );

    await upsertWeekTransition(
      updated.year,
      updated.month,
      updated.weekNumber,
      updated.budgetAmount,
      updated.totalSpent,
      updated.carryOver,
      updated.transactionCount
    );

    setSummaryData(updated);
    return updated;
  }

  return {
    showBottomSheet,
    showWizard,
    showFlowSavingsModal,
    summaryData,
    cachedAiSummary,
    accessToken,
    dismissCount,
    monthlySavings,
    flowSavingsTotals,
    onOpenWizard,
    onAcknowledge,
    onDismiss,
    onFlowSavingsConfirm,
    onFlowSavingsDismiss,
    recomputeSummary,
  };
}
