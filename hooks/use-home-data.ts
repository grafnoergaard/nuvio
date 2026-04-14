'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getBudgetStructure } from '@/lib/db-helpers';
import { fetchActiveSdsData, type SdsData } from '@/lib/standard-data-service';
import {
  getStreak,
  getWeeklyBudgetStreak,
  type QuickExpenseStreak,
  type QuickExpenseWeeklyStreak,
} from '@/lib/quick-expense-service';
import type { InvestmentSettings } from '@/lib/home-calculations';

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
let homeDataCache: { at: number; data: HomeDataSnapshot } | null = null;

function getHomeDataCache(): HomeDataSnapshot | null {
  if (!homeDataCache) return null;
  if (Date.now() - homeDataCache.at > HOME_DATA_CACHE_TTL) return null;
  return homeDataCache.data;
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

  const userIdRef = useRef<string | undefined>(undefined);

  function setUserRef(userId: string | undefined) {
    userIdRef.current = userId;
  }

  useEffect(() => {
    if (loading) return;
    homeDataCache = {
      at: Date.now(),
      data: {
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
      },
    };
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
  ]);

  async function loadHousehold() {
    if (!userIdRef.current) return;
    const { data } = await supabase
      .from('household')
      .select('members, variable_expense_estimate, adult_count, variable_children_birth_years')
      .eq('user_id', userIdRef.current)
      .maybeSingle();
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
  }

  async function loadInvestmentSettings() {
    const { data } = await supabase
      .from('investment_settings')
      .select('monthly_amount, current_amount, scenario, time_horizon, market_reaction')
      .maybeSingle();
    if (data && data.monthly_amount > 0) {
      setInvestmentSettings(data as InvestmentSettings);
    }
  }

  async function loadData() {
    try {
      const { data: activeBudgets } = await supabase
        .from('budgets')
        .select('id, name, year, onboarding_dismissed, has_variable_budget, opening_balance')
        .eq('is_active', true)
        .limit(1);

      let currentBudget: HomeBudget | null = null;
      if (activeBudgets && activeBudgets.length > 0) {
        currentBudget = activeBudgets[0] as HomeBudget;
      } else {
        const { data: fallbackBudgets } = await supabase
          .from('budgets')
          .select('id, name, year, onboarding_dismissed, has_variable_budget, opening_balance')
          .order('year', { ascending: false })
          .order('start_month', { ascending: false })
          .limit(1);
        if (!fallbackBudgets || fallbackBudgets.length === 0) {
          setLoading(false);
          return;
        }
        currentBudget = fallbackBudgets[0] as HomeBudget;
      }
      setBudget(currentBudget);

      const structure = await getBudgetStructure(currentBudget.id);
      if (!structure) { setLoading(false); return; }

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
      setLoading(false);
    }
  }

  function loadAll() {
    loadData();
    loadInvestmentSettings();
    fetchActiveSdsData().then(setSdsData);
    getStreak().then(setQuickStreak).catch(() => {});
    getWeeklyBudgetStreak().then(setWeeklyStreak).catch(() => {});
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
    loadData,
    loadHousehold,
    loadInvestmentSettings,
    loadAll,
    setBudget,
    setUserRef,
  };
}
