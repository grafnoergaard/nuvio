'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getBudgetStructure } from '@/lib/db-helpers';
import { fetchActiveSdsData, type SdsData } from '@/lib/standard-data-service';
import {
  getStreak,
  getMonthlyBudget,
  getQuickExpensesForMonth,
  getWeeklyBudgetStreak,
  computeWeeklyCarryOver,
  getUserWeekStartDay,
  type QuickExpenseStreak,
  type QuickExpenseWeeklyStreak,
  type WeeklyCarryOverSummary,
} from '@/lib/quick-expense-service';
import type { InvestmentSettings } from '@/lib/home-calculations';
import { toKuvertCopy } from '@/lib/kuvert-copy';

export interface FlowStatusConfig {
  warnHealthMin: number;
  kursenHealthMin: number;
  tempoHealthMin: number;
  flowHealthMin: number;
  badgeOver: string;
  badgeWarn: string;
  badgeKursen: string;
  badgeTempo: string;
  badgeFlow: string;
  headlineOver: string;
  headlineWarn: string;
  headlineKursen: string;
  headlineTempo: string;
  headlineFlow: string;
  colorOverBadge: string;
  colorWarnBadge: string;
  colorKursenBadge: string;
  colorTempoBadge: string;
  colorFlowBadge: string;
  colorOverCard: string;
  colorWarnCard: string;
  colorGoodCard: string;
  colorFlowCard: string;
}

export const FLOW_STATUS_DEFAULTS: FlowStatusConfig = {
  warnHealthMin: 30,
  kursenHealthMin: 0,
  tempoHealthMin: 60,
  flowHealthMin: 80,
  badgeOver: 'Over budget',
  badgeWarn: 'Stram op',
  badgeKursen: 'Hold kursen',
  badgeTempo: 'Godt tempo',
  badgeFlow: 'Udgifter',
  headlineOver: 'Du har overskredet dit budget',
  headlineWarn: 'Hold igen på forbruget',
  headlineKursen: 'Du er på rette spor',
  headlineTempo: 'Du klarer det fremragende',
  headlineFlow: 'Du har styr på udgifterne',
  colorOverBadge: 'bg-red-500',
  colorWarnBadge: 'bg-amber-500',
  colorKursenBadge: 'bg-emerald-500',
  colorTempoBadge: 'bg-emerald-500',
  colorFlowBadge: 'bg-amber-500',
  colorOverCard: 'bg-gradient-to-br from-red-50 via-rose-50/60 to-white border-red-200/60',
  colorWarnCard: 'bg-gradient-to-br from-amber-50 via-orange-50/40 to-white border-amber-200/60',
  colorGoodCard: 'bg-gradient-to-br from-emerald-50/80 via-teal-50/30 to-white border-emerald-200/50',
  colorFlowCard: 'bg-gradient-to-br from-slate-50 via-gray-50/80 to-white border-yellow-300/40',
};

export interface HomeBudget {
  id: string;
  name: string;
  year: number;
  onboarding_dismissed?: boolean;
  has_variable_budget?: boolean;
  opening_balance?: number;
}

export interface HomeDataState {
  budget: HomeBudget | null;
  expenses: number;
  income: number;
  recipientCount: number;
  loading: boolean;
  householdMonthlyIncome: number;
  variableExpenseEstimate: number | null;
  investmentSettings: InvestmentSettings | null;
  sdsData: SdsData | null;
  householdAdultCount: number;
  householdChildBirthYears: (number | null)[];
  categoryGroupTypes: Array<{ name: string; kind: 'income' | 'expense' | 'variable_expense' | 'savings' | 'investment' | 'frirum' }>;
  quickStreak: QuickExpenseStreak | null;
  weeklyStreak: QuickExpenseWeeklyStreak | null;
  flowMonthlyBudget: number;
  flowMonthlySpent: number;
  flowScoreThreshold: number;
  flowStatusConfig: FlowStatusConfig;
  flowWeeklyStatus: WeeklyCarryOverSummary | null;
}

export interface HomeDataActions {
  loadData: () => Promise<void>;
  loadHousehold: () => Promise<void>;
  loadInvestmentSettings: () => Promise<void>;
  loadAll: () => void;
  setBudget: React.Dispatch<React.SetStateAction<HomeBudget | null>>;
  setUserRef: (userId: string | undefined) => void;
}

type HomeDataSnapshot = Omit<HomeDataState, 'loading'>;

const HOME_DATA_CACHE_TTL = 60_000;
const HOME_DATA_PERSISTED_CACHE_TTL = 6 * 60 * 60 * 1000;
const HOME_DATA_STORAGE_KEY = 'kuvert.homeData.v1';
let homeDataCache: { at: number; data: HomeDataSnapshot } | null = null;

function getHomeDataCache(): HomeDataSnapshot | null {
  const now = Date.now();
  if (homeDataCache && now - homeDataCache.at <= HOME_DATA_CACHE_TTL) {
    return homeDataCache.data;
  }

  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(HOME_DATA_STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as { at?: number; data?: HomeDataSnapshot };
    if (!cached.at || !cached.data) return null;
    if (now - cached.at > HOME_DATA_PERSISTED_CACHE_TTL) return null;
    homeDataCache = { at: cached.at, data: cached.data };
    return cached.data;
  } catch {
    return null;
  }
}

function persistHomeDataCache(data: HomeDataSnapshot) {
  const payload = { at: Date.now(), data };
  homeDataCache = payload;

  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HOME_DATA_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Browser storage can be full or unavailable in private mode.
  }
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function useHomeData(): HomeDataState & HomeDataActions {
  const initialCache = getHomeDataCache();
  const [budget, setBudget] = useState<HomeBudget | null>(initialCache?.budget ?? null);
  const [expenses, setExpenses] = useState(initialCache?.expenses ?? 0);
  const [income, setIncome] = useState(initialCache?.income ?? 0);
  const [recipientCount, setRecipientCount] = useState(initialCache?.recipientCount ?? 0);
  const [loading, setLoading] = useState(!initialCache);
  const [householdMonthlyIncome, setHouseholdMonthlyIncome] = useState(initialCache?.householdMonthlyIncome ?? 0);
  const [variableExpenseEstimate, setVariableExpenseEstimate] = useState<number | null>(initialCache?.variableExpenseEstimate ?? null);
  const [investmentSettings, setInvestmentSettings] = useState<InvestmentSettings | null>(initialCache?.investmentSettings ?? null);
  const [sdsData, setSdsData] = useState<SdsData | null>(initialCache?.sdsData ?? null);
  const [householdAdultCount, setHouseholdAdultCount] = useState(initialCache?.householdAdultCount ?? 1);
  const [householdChildBirthYears, setHouseholdChildBirthYears] = useState<(number | null)[]>(initialCache?.householdChildBirthYears ?? []);
  const [categoryGroupTypes, setCategoryGroupTypes] = useState<Array<{ name: string; kind: 'income' | 'expense' | 'variable_expense' | 'savings' | 'investment' | 'frirum' }>>(initialCache?.categoryGroupTypes ?? []);
  const [quickStreak, setQuickStreak] = useState<QuickExpenseStreak | null>(initialCache?.quickStreak ?? null);
  const [weeklyStreak, setWeeklyStreak] = useState<QuickExpenseWeeklyStreak | null>(initialCache?.weeklyStreak ?? null);
  const [flowMonthlyBudget, setFlowMonthlyBudget] = useState(initialCache?.flowMonthlyBudget ?? 0);
  const [flowMonthlySpent, setFlowMonthlySpent] = useState(initialCache?.flowMonthlySpent ?? 0);
  const [flowScoreThreshold, setFlowScoreThreshold] = useState(initialCache?.flowScoreThreshold ?? 0.15);
  const [flowStatusConfig, setFlowStatusConfig] = useState<FlowStatusConfig>(initialCache?.flowStatusConfig ?? FLOW_STATUS_DEFAULTS);
  const [flowWeeklyStatus, setFlowWeeklyStatus] = useState<WeeklyCarryOverSummary | null>(initialCache?.flowWeeklyStatus ?? null);

  const userIdRef = useRef<string | undefined>(undefined);

  function setUserRef(userId: string | undefined) {
    userIdRef.current = userId;
  }

  useEffect(() => {
    if (loading) return;
    persistHomeDataCache({
      budget,
      expenses,
      income,
      recipientCount,
      householdMonthlyIncome,
      variableExpenseEstimate,
      investmentSettings,
      sdsData,
      householdAdultCount,
      householdChildBirthYears,
      categoryGroupTypes,
      quickStreak,
      weeklyStreak,
      flowMonthlyBudget,
      flowMonthlySpent,
      flowScoreThreshold,
      flowStatusConfig,
      flowWeeklyStatus,
    });
  }, [
    loading,
    budget,
    expenses,
    income,
    recipientCount,
    householdMonthlyIncome,
    variableExpenseEstimate,
    investmentSettings,
    sdsData,
    householdAdultCount,
    householdChildBirthYears,
    categoryGroupTypes,
    quickStreak,
    weeklyStreak,
    flowMonthlyBudget,
    flowMonthlySpent,
    flowScoreThreshold,
    flowStatusConfig,
    flowWeeklyStatus,
  ]);

  async function loadHousehold() {
    if (!userIdRef.current) return;
    try {
      const { data } = await withTimeout(
        supabase
          .from('household')
          .select('members, variable_expense_estimate, adult_count, variable_children_birth_years')
          .eq('user_id', userIdRef.current)
          .maybeSingle(),
        2500,
        'household'
      );
      if (data?.members) {
        const members = data.members as Array<{ type: string; monthly_net_salary: number | null }>;
        const total = members.filter(m => m.type === 'adult').reduce((sum, m) => sum + (m.monthly_net_salary ?? 0), 0);
        setHouseholdMonthlyIncome(total);
        setHouseholdAdultCount(members.filter(m => m.type === 'adult').length || 1);
      }
      if (data?.variable_expense_estimate != null) {
        setVariableExpenseEstimate(Number(data.variable_expense_estimate));
      }
      if (data && Array.isArray(data.variable_children_birth_years)) {
        setHouseholdChildBirthYears(data.variable_children_birth_years as (number | null)[]);
      }
    } catch (error) {
      console.warn('Household data skipped:', error);
    }
  }

  async function loadInvestmentSettings() {
    try {
      const { data } = await withTimeout(
        supabase
          .from('investment_settings')
          .select('monthly_amount, current_amount, scenario, time_horizon, market_reaction')
          .maybeSingle(),
        2500,
        'investment settings'
      );
      if (data && data.monthly_amount > 0) {
        setInvestmentSettings(data as InvestmentSettings);
      }
    } catch (error) {
      console.warn('Investment settings skipped:', error);
    }
  }

  async function loadData() {
    let initialLoadingReleased = false;
    const releaseInitialLoading = () => {
      if (initialLoadingReleased) return;
      initialLoadingReleased = true;
      setLoading(false);
    };
    const loadingFallback = window.setTimeout(releaseInitialLoading, budget ? 900 : 3500);

    try {
      const { data: activeBudgets } = await withTimeout(
        supabase
          .from('budgets')
          .select('id, name, year, onboarding_dismissed, has_variable_budget, opening_balance')
          .eq('is_active', true)
          .limit(1),
        3000,
        'active budget'
      );

      let currentBudget: HomeBudget | null = null;
      if (activeBudgets && activeBudgets.length > 0) {
        currentBudget = activeBudgets[0] as HomeBudget;
      } else {
        const { data: fallbackBudgets } = await withTimeout(
          supabase
            .from('budgets')
            .select('id, name, year, onboarding_dismissed, has_variable_budget, opening_balance')
            .order('year', { ascending: false })
            .order('start_month', { ascending: false })
            .limit(1),
          3000,
          'fallback budget'
        );
        if (!fallbackBudgets || fallbackBudgets.length === 0) {
          releaseInitialLoading();
          return;
        }
        currentBudget = fallbackBudgets[0] as HomeBudget;
      }
      setBudget(currentBudget);
      releaseInitialLoading();

      const structure = await withTimeout(getBudgetStructure(currentBudget.id), 3500, 'budget structure');
      if (!structure) return;

      let totalExpenses = 0;
      const recipientSet = new Set<string>();
      structure.categoryGroups.forEach((group: any) => {
        if (group.is_income) return;
        group.categories.forEach((category: any) => {
          category.recipients.forEach((recipient: any) => {
            for (let month = 1; month <= 12; month++) {
              const planned = Math.abs(recipient.monthlyPlans[month] || 0);
              const actual = Math.abs(recipient.monthlyActuals[month] || 0);
              totalExpenses += planned !== 0 ? planned : actual;
            }
            if (recipient.id && !recipient.id.startsWith('no-recipient-')) recipientSet.add(recipient.id);
          });
        });
      });

      setIncome(0);
      setExpenses(totalExpenses);
      setRecipientCount(recipientSet.size);
      setCategoryGroupTypes(structure.categoryGroups.map((g: any) => ({
        name: g.name,
        kind: g.is_income ? 'income' : 'expense',
      })));
    } catch (error: unknown) {
      console.error('Error loading home data:', error);
    } finally {
      window.clearTimeout(loadingFallback);
      releaseInitialLoading();
    }
  }

  async function loadFlowSnapshot() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const [monthlyBudget, quickExpenses, flowConfigEntries, userWeekStartDay] = await Promise.all([
      getMonthlyBudget(year, month),
      getQuickExpensesForMonth(year, month),
      supabase
        .from('standard_data_entries')
        .select('key, value_numeric, value_text')
        .eq('section', 'nuvio_flow'),
      getUserWeekStartDay(),
    ]);
    const budgetAmount = monthlyBudget?.budget_amount ?? 0;
    setFlowMonthlyBudget(budgetAmount);
    setFlowMonthlySpent(quickExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0));

    if (flowConfigEntries.data && flowConfigEntries.data.length > 0) {
      const m = new Map(flowConfigEntries.data.map((entry: any) => [entry.key, entry]));
      const n = (key: string, fallback: number) => (m.get(key) as any)?.value_numeric ?? fallback;
      const t = (key: string, fallback: string) => toKuvertCopy((m.get(key) as any)?.value_text ?? fallback);
      const d = FLOW_STATUS_DEFAULTS;
      setFlowScoreThreshold(n('NUVIO_FLOW_SCORE_PERFECT_THRESHOLD', 0.15));
      setFlowStatusConfig({
        warnHealthMin: n('FLOW_STATUS_WARN_HEALTH_MIN', d.warnHealthMin),
        kursenHealthMin: n('FLOW_STATUS_KURSEN_HEALTH_MIN', d.kursenHealthMin),
        tempoHealthMin: n('FLOW_STATUS_TEMPO_HEALTH_MIN', d.tempoHealthMin),
        flowHealthMin: n('FLOW_STATUS_FLOW_HEALTH_MIN', d.flowHealthMin),
        badgeOver: t('FLOW_BADGE_OVER', d.badgeOver),
        badgeWarn: t('FLOW_BADGE_WARN', d.badgeWarn),
        badgeKursen: t('FLOW_BADGE_KURSEN', d.badgeKursen),
        badgeTempo: t('FLOW_BADGE_TEMPO', d.badgeTempo),
        badgeFlow: t('FLOW_BADGE_FLOW', d.badgeFlow),
        headlineOver: t('FLOW_HEADLINE_OVER', d.headlineOver),
        headlineWarn: t('FLOW_HEADLINE_WARN', d.headlineWarn),
        headlineKursen: t('FLOW_HEADLINE_KURSEN', d.headlineKursen),
        headlineTempo: t('FLOW_HEADLINE_TEMPO', d.headlineTempo),
        headlineFlow: t('FLOW_HEADLINE_FLOW', d.headlineFlow),
        colorOverBadge: t('FLOW_COLOR_OVER_BADGE', d.colorOverBadge),
        colorWarnBadge: t('FLOW_COLOR_WARN_BADGE', d.colorWarnBadge),
        colorKursenBadge: t('FLOW_COLOR_KURSEN_BADGE', d.colorKursenBadge),
        colorTempoBadge: t('FLOW_COLOR_TEMPO_BADGE', d.colorTempoBadge),
        colorFlowBadge: t('FLOW_COLOR_FLOW_BADGE', d.colorFlowBadge),
        colorOverCard: t('FLOW_COLOR_OVER_CARD', d.colorOverCard),
        colorWarnCard: t('FLOW_COLOR_WARN_CARD', d.colorWarnCard),
        colorGoodCard: t('FLOW_COLOR_GOOD_CARD', d.colorGoodCard),
        colorFlowCard: t('FLOW_COLOR_FLOW_CARD', d.colorFlowCard),
      });
    }

    setFlowWeeklyStatus(
      budgetAmount > 0 ? computeWeeklyCarryOver(budgetAmount, year, month, quickExpenses, now, userWeekStartDay) : null
    );
  }

  function loadAll() {
    loadData();
    loadInvestmentSettings();
    fetchActiveSdsData().then(setSdsData);
    getStreak().then(setQuickStreak).catch(() => {});
    getWeeklyBudgetStreak().then(setWeeklyStreak).catch(() => {});
    loadFlowSnapshot().catch(() => {});
    if (userIdRef.current) loadHousehold();
  }

  return {
    budget,
    expenses,
    income,
    recipientCount,
    loading,
    householdMonthlyIncome,
    variableExpenseEstimate,
    investmentSettings,
    sdsData,
    householdAdultCount,
    householdChildBirthYears,
    categoryGroupTypes,
    quickStreak,
    weeklyStreak,
    flowMonthlyBudget,
    flowMonthlySpent,
    flowScoreThreshold,
    flowStatusConfig,
    flowWeeklyStatus,
    loadData,
    loadHousehold,
    loadInvestmentSettings,
    loadAll,
    setBudget,
    setUserRef,
  };
}
