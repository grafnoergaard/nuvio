import { supabase } from '@/lib/supabase';

export interface SdsVersion {
  id: string;
  version: string;
  valid_from: string;
  valid_to: string;
  currency: string;
  locale: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SdsEntry {
  id: string;
  version_id: string;
  section: string;
  key: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  label: string;
  notes: string | null;
  requires_admin_value: boolean;
  sort_order: number;
  created_at: string;
}

export interface SdsRaadighed {
  base_single_monthly: number;
  extra_adult_monthly: number;
  child_addon_0_1_monthly: number;
  child_addon_2_6_monthly: number;
  child_addon_7_17_monthly: number;
}

export interface SdsCarBudget {
  id: string;
  price_class_dkk: number;
  type: 'ICE' | 'EV';
  total_dkk_per_month: number;
  label: string;
}

export interface SdsCalculationRates {
  adult_standard: number;
  student_single: number;
  student_couple: number;
  child_0_2: number;
  child_3_12: number;
  child_13_17: number;
  regional_urban_high: number;
  regional_urban_med: number;
  regional_urban_low: number;
  regional_rural: number;
}

export interface SdsPostalRange {
  id: string;
  label: string;
  postal_from: number;
  postal_to: number;
  rate_key: string;
  sort_order: number;
}

export interface SdsHouseholdExpenseRule {
  base_amount: number;
  adult_multiplier: number;
  child_multiplier: number;
}

export interface SdsFixedExpenses {
  housing_monthly: number;
  insurance_monthly: number;
  utilities_monthly: number;
  subscriptions_monthly: number;
  transport_monthly: number;
  children_monthly: number;
  insurance: SdsHouseholdExpenseRule;
  utilities: SdsHouseholdExpenseRule;
  subscriptions: SdsHouseholdExpenseRule;
  transport: SdsHouseholdExpenseRule;
}

export function computeHouseholdExpense(
  rule: SdsHouseholdExpenseRule,
  adults: number,
  children: number,
): number {
  return rule.base_amount + rule.adult_multiplier * adults + rule.child_multiplier * children;
}

export interface SdsHousingLineItem {
  key: string;
  label: string;
  amount: number;
}

export interface SdsHousingTypeExpenses {
  ejerbolig: SdsHousingLineItem[];
  ejerlejlighed: SdsHousingLineItem[];
  andelsbolig: SdsHousingLineItem[];
  lejebolig: SdsHousingLineItem[];
}

export interface SdsData {
  version: SdsVersion;
  raadighed: SdsRaadighed;
  carBudgets: SdsCarBudget[];
  defaultCarBudgetId: string;
  heatKwhPerM2PerYear: number;
  calculationRates: SdsCalculationRates;
  postalRanges: SdsPostalRange[];
  fixedExpenses: SdsFixedExpenses;
  housingTypeExpenses: SdsHousingTypeExpenses;
}

export const SDS_FALLBACK: SdsData = {
  version: {
    id: 'fallback',
    version: '2025.1',
    valid_from: '2025-01-01',
    valid_to: '2025-12-31',
    currency: 'DKK',
    locale: 'da-DK',
    notes: 'Fallback hardcoded values',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  raadighed: {
    base_single_monthly: 7520,
    extra_adult_monthly: 5230,
    child_addon_0_1_monthly: 2050,
    child_addon_2_6_monthly: 2620,
    child_addon_7_17_monthly: 3770,
  },
  carBudgets: [
    { id: 'NEW_ICE_150K', price_class_dkk: 150000, type: 'ICE', total_dkk_per_month: 5096, label: 'Benzin/diesel 150.000 kr.' },
    { id: 'NEW_ICE_200K', price_class_dkk: 200000, type: 'ICE', total_dkk_per_month: 5746, label: 'Benzin/diesel 200.000 kr.' },
    { id: 'NEW_EV_200K',  price_class_dkk: 200000, type: 'EV',  total_dkk_per_month: 5051, label: 'Elbil 200.000 kr.' },
    { id: 'NEW_ICE_300K', price_class_dkk: 300000, type: 'ICE', total_dkk_per_month: 7001, label: 'Benzin/diesel 300.000 kr.' },
    { id: 'NEW_EV_300K',  price_class_dkk: 300000, type: 'EV',  total_dkk_per_month: 6290, label: 'Elbil 300.000 kr.' },
    { id: 'NEW_ICE_400K', price_class_dkk: 400000, type: 'ICE', total_dkk_per_month: 8230, label: 'Benzin/diesel 400.000 kr.' },
    { id: 'NEW_EV_400K',  price_class_dkk: 400000, type: 'EV',  total_dkk_per_month: 7373, label: 'Elbil 400.000 kr.' },
  ],
  defaultCarBudgetId: 'NEW_ICE_150K',
  heatKwhPerM2PerYear: 97,
  fixedExpenses: {
    housing_monthly: 12000,
    insurance_monthly: 2200,
    utilities_monthly: 1800,
    subscriptions_monthly: 900,
    transport_monthly: 2400,
    children_monthly: 1800,
    insurance:     { base_amount: 900,  adult_multiplier: 350,  child_multiplier: 200 },
    utilities:     { base_amount: 1300, adult_multiplier: 350,  child_multiplier: 250 },
    subscriptions: { base_amount: 600,  adult_multiplier: 150,  child_multiplier: 100 },
    transport:     { base_amount: 2000, adult_multiplier: 1000, child_multiplier: 300 },
  },
  housingTypeExpenses: {
    ejerbolig: [
      { key: 'FIXED_EJERBOLIG_REALKREDIT_MONTHLY',        label: 'Realkredit',            amount: 11500 },
      { key: 'FIXED_EJERBOLIG_EJENDOMSSKAT_MONTHLY',      label: 'Ejendomsskat',          amount: 2000  },
      { key: 'FIXED_EJERBOLIG_GRUNDEJERFORENING_MONTHLY', label: 'Grundejerforening',     amount: 350   },
      { key: 'FIXED_EJERBOLIG_VEDLIGEHOLD_MONTHLY',       label: 'Vedligehold',           amount: 2000  },
      { key: 'FIXED_EJERBOLIG_HUSFORSIKRING_MONTHLY',     label: 'Husforsikring',         amount: 1200  },
      { key: 'FIXED_EJERBOLIG_HAVEFORENING_MONTHLY',      label: 'Haveforening/vejbidrag',amount: 500   },
    ],
    ejerlejlighed: [
      { key: 'FIXED_EJERLEJLIGHED_REALKREDIT_MONTHLY',         label: 'Realkredit',        amount: 10500 },
      { key: 'FIXED_EJERLEJLIGHED_EJENDOMSSKAT_MONTHLY',       label: 'Ejendomsskat',      amount: 1500  },
      { key: 'FIXED_EJERLEJLIGHED_FAELLESUDGIFTER_MONTHLY',    label: 'Fællesudgifter',    amount: 3000  },
      { key: 'FIXED_EJERLEJLIGHED_VEDLIGEHOLD_MONTHLY',        label: 'Vedligehold',       amount: 1000  },
    ],
    andelsbolig: [
      { key: 'FIXED_ANDELSBOLIG_BOLIGAFGIFT_MONTHLY',    label: 'Boligafgift',     amount: 8000 },
      { key: 'FIXED_ANDELSBOLIG_ANDELSLAN_MONTHLY',      label: 'Andelslån',       amount: 5000 },
      { key: 'FIXED_ANDELSBOLIG_VEDLIGEHOLD_MONTHLY',    label: 'Vedligehold',     amount: 1000 },
      { key: 'FIXED_ANDELSBOLIG_FORSIKRINGER_MONTHLY',   label: 'Forsikringer',    amount: 2000 },
      { key: 'FIXED_ANDELSBOLIG_ELVANDSVARME_MONTHLY',   label: 'El/Vand/Varme',  amount: 2000 },
    ],
    lejebolig: [
      { key: 'FIXED_LEJEBOLIG_HUSLEJE_MONTHLY', label: 'Husleje', amount: 11500 },
    ],
  },
  calculationRates: {
    adult_standard: 7520,
    student_single: 3200,
    student_couple: 3000,
    child_0_2: 2050,
    child_3_12: 2620,
    child_13_17: 3770,
    regional_urban_high: 0.10,
    regional_urban_med: 0.05,
    regional_urban_low: 0.03,
    regional_rural: -0.03,
  },
  postalRanges: [
    { id: '1', label: 'København og omegn',         postal_from: 1000, postal_to: 2999, rate_key: 'regional_urban_high', sort_order: 1 },
    { id: '2', label: 'Aarhus',                      postal_from: 8000, postal_to: 8999, rate_key: 'regional_urban_med',  sort_order: 2 },
    { id: '3', label: 'Odense og Sydjylland',         postal_from: 5000, postal_to: 6999, rate_key: 'regional_urban_low',  sort_order: 3 },
    { id: '4', label: 'Bornholm',                     postal_from: 3700, postal_to: 3999, rate_key: 'regional_rural',      sort_order: 4 },
    { id: '5', label: 'Sydsjælland og øer',           postal_from: 4700, postal_to: 4999, rate_key: 'regional_rural',      sort_order: 5 },
    { id: '6', label: 'Thy og Mors',                  postal_from: 7900, postal_to: 7999, rate_key: 'regional_rural',      sort_order: 6 },
    { id: '7', label: 'Nordjylland (nordligste del)', postal_from: 9700, postal_to: 9999, rate_key: 'regional_rural',      sort_order: 7 },
  ],
};

export async function fetchActiveSdsData(): Promise<SdsData> {
  const today = new Date().toISOString().split('T')[0];

  const { data: versions } = await supabase
    .from('standard_data_versions')
    .select('*')
    .eq('is_active', true)
    .lte('valid_from', today)
    .gte('valid_to', today)
    .order('valid_from', { ascending: false })
    .limit(1);

  if (!versions || versions.length === 0) return SDS_FALLBACK;

  const version = versions[0] as SdsVersion;

  const { data: entries } = await supabase
    .from('standard_data_entries')
    .select('*')
    .eq('version_id', version.id);

  if (!entries || entries.length === 0) return { ...SDS_FALLBACK, version };

  const map = new Map<string, SdsEntry>();
  for (const e of entries as SdsEntry[]) {
    map.set(e.key, e);
  }

  function num(key: string, fallback: number): number {
    const e = map.get(key);
    if (!e) return fallback;
    if (e.value_numeric !== null) return e.value_numeric;
    if (e.value_text !== null) {
      const parsed = parseFloat(e.value_text);
      if (!isNaN(parsed)) return parsed;
    }
    return fallback;
  }

  function txt(key: string, fallback: string): string {
    const e = map.get(key);
    if (!e || e.value_text === null) return fallback;
    return e.value_text;
  }

  const raadighed: SdsRaadighed = {
    base_single_monthly: num('RAADIGHED_BASE_SINGLE_MONTHLY', SDS_FALLBACK.raadighed.base_single_monthly),
    extra_adult_monthly: num('RAADIGHED_EXTRA_ADULT_IN_HOUSEHOLD_MONTHLY', SDS_FALLBACK.raadighed.extra_adult_monthly),
    child_addon_0_1_monthly: num('CHILD_ADDON_0_1_MONTHLY', SDS_FALLBACK.raadighed.child_addon_0_1_monthly),
    child_addon_2_6_monthly: num('CHILD_ADDON_2_6_MONTHLY', SDS_FALLBACK.raadighed.child_addon_2_6_monthly),
    child_addon_7_17_monthly: num('CHILD_ADDON_7_17_MONTHLY', SDS_FALLBACK.raadighed.child_addon_7_17_monthly),
  };

  const carBudgets: SdsCarBudget[] = [
    { id: 'NEW_ICE_150K', price_class_dkk: 150000, type: 'ICE', total_dkk_per_month: num('CAR_BUDGET_NEW_ICE_150K_MONTHLY', 5096), label: 'Benzin/diesel 150.000 kr.' },
    { id: 'NEW_ICE_200K', price_class_dkk: 200000, type: 'ICE', total_dkk_per_month: num('CAR_BUDGET_NEW_ICE_200K_MONTHLY', 5746), label: 'Benzin/diesel 200.000 kr.' },
    { id: 'NEW_EV_200K',  price_class_dkk: 200000, type: 'EV',  total_dkk_per_month: num('CAR_BUDGET_NEW_EV_200K_MONTHLY', 5051),  label: 'Elbil 200.000 kr.' },
    { id: 'NEW_ICE_300K', price_class_dkk: 300000, type: 'ICE', total_dkk_per_month: num('CAR_BUDGET_NEW_ICE_300K_MONTHLY', 7001), label: 'Benzin/diesel 300.000 kr.' },
    { id: 'NEW_EV_300K',  price_class_dkk: 300000, type: 'EV',  total_dkk_per_month: num('CAR_BUDGET_NEW_EV_300K_MONTHLY', 6290),  label: 'Elbil 300.000 kr.' },
    { id: 'NEW_ICE_400K', price_class_dkk: 400000, type: 'ICE', total_dkk_per_month: num('CAR_BUDGET_NEW_ICE_400K_MONTHLY', 8230), label: 'Benzin/diesel 400.000 kr.' },
    { id: 'NEW_EV_400K',  price_class_dkk: 400000, type: 'EV',  total_dkk_per_month: num('CAR_BUDGET_NEW_EV_400K_MONTHLY', 7373),  label: 'Elbil 400.000 kr.' },
  ];

  const defaultCarBudgetId = txt('CAR_BUDGET_DEFAULT_ID', 'NEW_ICE_150K');
  const heatKwhPerM2PerYear = num('HEAT_FJERNVARME_ETAGEBOLIG_KWH_PER_M2_PER_YEAR', 97);

  const fixedExpenses: SdsFixedExpenses = {
    housing_monthly: num('FIXED_HOUSING_MONTHLY', SDS_FALLBACK.fixedExpenses.housing_monthly),
    insurance_monthly: num('FIXED_INSURANCE_MONTHLY', SDS_FALLBACK.fixedExpenses.insurance_monthly),
    utilities_monthly: num('FIXED_UTILITIES_MONTHLY', SDS_FALLBACK.fixedExpenses.utilities_monthly),
    subscriptions_monthly: num('FIXED_SUBSCRIPTIONS_MONTHLY', SDS_FALLBACK.fixedExpenses.subscriptions_monthly),
    transport_monthly: num('FIXED_TRANSPORT_MONTHLY', SDS_FALLBACK.fixedExpenses.transport_monthly),
    children_monthly: num('FIXED_CHILDREN_MONTHLY', SDS_FALLBACK.fixedExpenses.children_monthly),
    insurance: {
      base_amount:       num('FIXED_INSURANCE_BASE',              SDS_FALLBACK.fixedExpenses.insurance.base_amount),
      adult_multiplier:  num('FIXED_INSURANCE_ADULT_MULTIPLIER',  SDS_FALLBACK.fixedExpenses.insurance.adult_multiplier),
      child_multiplier:  num('FIXED_INSURANCE_CHILD_MULTIPLIER',  SDS_FALLBACK.fixedExpenses.insurance.child_multiplier),
    },
    utilities: {
      base_amount:       num('FIXED_UTILITIES_BASE',              SDS_FALLBACK.fixedExpenses.utilities.base_amount),
      adult_multiplier:  num('FIXED_UTILITIES_ADULT_MULTIPLIER',  SDS_FALLBACK.fixedExpenses.utilities.adult_multiplier),
      child_multiplier:  num('FIXED_UTILITIES_CHILD_MULTIPLIER',  SDS_FALLBACK.fixedExpenses.utilities.child_multiplier),
    },
    subscriptions: {
      base_amount:       num('FIXED_SUBSCRIPTIONS_BASE',              SDS_FALLBACK.fixedExpenses.subscriptions.base_amount),
      adult_multiplier:  num('FIXED_SUBSCRIPTIONS_ADULT_MULTIPLIER',  SDS_FALLBACK.fixedExpenses.subscriptions.adult_multiplier),
      child_multiplier:  num('FIXED_SUBSCRIPTIONS_CHILD_MULTIPLIER',  SDS_FALLBACK.fixedExpenses.subscriptions.child_multiplier),
    },
    transport: {
      base_amount:       num('FIXED_TRANSPORT_BASE',              SDS_FALLBACK.fixedExpenses.transport.base_amount),
      adult_multiplier:  num('FIXED_TRANSPORT_ADULT_MULTIPLIER',  SDS_FALLBACK.fixedExpenses.transport.adult_multiplier),
      child_multiplier:  num('FIXED_TRANSPORT_CHILD_MULTIPLIER',  SDS_FALLBACK.fixedExpenses.transport.child_multiplier),
    },
  };

  const calculationRates: SdsCalculationRates = {
    adult_standard: num('RAADIGHED_BASE_SINGLE_MONTHLY', SDS_FALLBACK.calculationRates.adult_standard),
    student_single: num('CALC_STUDENT_SINGLE', SDS_FALLBACK.calculationRates.student_single),
    student_couple: num('CALC_STUDENT_COUPLE', SDS_FALLBACK.calculationRates.student_couple),
    child_0_2: num('CHILD_ADDON_0_1_MONTHLY', SDS_FALLBACK.calculationRates.child_0_2),
    child_3_12: num('CHILD_ADDON_2_6_MONTHLY', SDS_FALLBACK.calculationRates.child_3_12),
    child_13_17: num('CHILD_ADDON_7_17_MONTHLY', SDS_FALLBACK.calculationRates.child_13_17),
    regional_urban_high: num('CALC_REGIONAL_URBAN_HIGH', SDS_FALLBACK.calculationRates.regional_urban_high),
    regional_urban_med: num('CALC_REGIONAL_URBAN_MED', SDS_FALLBACK.calculationRates.regional_urban_med),
    regional_urban_low: num('CALC_REGIONAL_URBAN_LOW', SDS_FALLBACK.calculationRates.regional_urban_low),
    regional_rural: num('CALC_REGIONAL_RURAL', SDS_FALLBACK.calculationRates.regional_rural),
  };

  let postalRanges: SdsPostalRange[] = SDS_FALLBACK.postalRanges;
  const postalEntry = map.get('CALC_POSTAL_RANGES_JSON');
  if (postalEntry?.value_text) {
    try {
      const parsed = JSON.parse(postalEntry.value_text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        postalRanges = parsed as SdsPostalRange[];
      }
    } catch {
      // fall through to fallback
    }
  }

  const housingTypeExpenses: SdsHousingTypeExpenses = {
    ejerbolig: SDS_FALLBACK.housingTypeExpenses.ejerbolig.map(item => ({
      ...item,
      amount: num(item.key, item.amount),
    })),
    ejerlejlighed: SDS_FALLBACK.housingTypeExpenses.ejerlejlighed.map(item => ({
      ...item,
      amount: num(item.key, item.amount),
    })),
    andelsbolig: SDS_FALLBACK.housingTypeExpenses.andelsbolig.map(item => ({
      ...item,
      amount: num(item.key, item.amount),
    })),
    lejebolig: SDS_FALLBACK.housingTypeExpenses.lejebolig.map(item => ({
      ...item,
      amount: num(item.key, item.amount),
    })),
  };

  return { version, raadighed, carBudgets, defaultCarBudgetId, heatKwhPerM2PerYear, fixedExpenses, housingTypeExpenses, calculationRates, postalRanges };
}

export function computeSdsRaadighedMonthly(
  adults: number,
  childBirthYears: (number | null)[],
  raadighed: SdsRaadighed,
  referenceYear?: number,
): number {
  const year = referenceYear ?? new Date().getFullYear();

  const adultTotal = raadighed.base_single_monthly + raadighed.extra_adult_monthly * Math.max(0, adults - 1);

  const childTotal = childBirthYears.reduce<number>((sum, birthYear) => {
    if (!birthYear) return sum;
    const age = year - birthYear;
    if (age <= 1)  return sum + raadighed.child_addon_0_1_monthly;
    if (age <= 6)  return sum + raadighed.child_addon_2_6_monthly;
    if (age <= 17) return sum + raadighed.child_addon_7_17_monthly;
    return sum;
  }, 0);

  return adultTotal + childTotal;
}
