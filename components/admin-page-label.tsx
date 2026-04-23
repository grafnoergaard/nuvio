'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export function AdminCardLabel({ types }: { types: Array<{ name: string; kind: 'income' | 'expense' | 'variable_expense' | 'savings' | 'investment' | 'frirum' }> }) {
  const { isAdmin, loading } = useAuth();
  if (loading || !isAdmin || types.length === 0) return null;
  const income = types.filter(t => t.kind === 'income');
  const expense = types.filter(t => t.kind === 'expense');
  const variableExpense = types.filter(t => t.kind === 'variable_expense');
  const savings = types.filter(t => t.kind === 'savings');
  const investment = types.filter(t => t.kind === 'investment');
  const frirum = types.filter(t => t.kind === 'frirum');
  return (
    <div className="flex flex-wrap gap-1 px-3 pt-2 pb-0 pointer-events-none select-none">
      {income.length > 0 && (
        <span className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
          Indkomst: {income.map(t => t.name).join(', ')}
        </span>
      )}
      {expense.length > 0 && (
        <span className="text-xs font-mono text-rose-700 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">
          Faste udgifter: {expense.map(t => t.name).join(', ')}
        </span>
      )}
      {variableExpense.length > 0 && (
        <span className="text-xs font-mono text-orange-700 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
          Variable udgifter: {variableExpense.map(t => t.name).join(', ')}
        </span>
      )}
      {savings.length > 0 && (
        <span className="text-xs font-mono text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
          Opsparing: {savings.map(t => t.name).join(', ')}
        </span>
      )}
      {investment.length > 0 && (
        <span className="text-xs font-mono text-teal-700 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5">
          Investering: {investment.map(t => t.name).join(', ')}
        </span>
      )}
      {frirum.length > 0 && (
        <span className="text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
          Frirum: {frirum.map(t => t.name).join(' − ')}
        </span>
      )}
    </div>
  );
}

interface WizardInfo {
  name: string;
  step: number;
  totalSteps: number;
  stepLabel?: string;
}

interface DataTypeInfo {
  name: string;
  kind: 'income' | 'expense' | 'variable_expense' | 'savings' | 'investment' | 'frirum';
}

interface AdminLabelContextValue {
  setWizard: (info: WizardInfo | null) => void;
  setDataTypes: (types: DataTypeInfo[]) => void;
}

const AdminLabelContext = createContext<AdminLabelContextValue>({ setWizard: () => {}, setDataTypes: () => {} });

export function useAdminLabel() {
  return useContext(AdminLabelContext);
}

const PAGE_NAMES: Record<string, string> = {
  '/': 'Hjem',
  '/indbakke': 'Indbakke',
  '/budgets': 'Budgetter',
  '/plan': 'Plan',
  '/variable-forbrug': 'Variable forbrug',
  '/husstand': 'Husstand',
  '/investering': 'Investering',
  '/maal': 'Mål',
  '/anbefalinger': 'Anbefalinger',
  '/checkup': 'Checkup',
  '/indstillinger': 'Indstillinger',
  '/login': 'Login',
  '/admin': 'Admin · Design',
  '/admin/brugere': 'Admin · Brugere',
  '/admin/mini-checkup': 'Admin · Nuvio Checkup',
  '/admin/checkup': 'Admin · Onboarding standardværdier',
  '/admin/advisory-engine': 'Admin · Advisory Engine',
  '/admin/navigation': 'Admin · Navigation',
  '/admin/push': 'Admin · Push',
  '/admin/why': 'Admin · Why Wizard',
};

function resolvePageName(pathname: string): string {
  if (PAGE_NAMES[pathname]) return PAGE_NAMES[pathname];
  const budgetMatch = pathname.match(/^\/budgets\/([^/]+)(\/(.+))?$/);
  if (budgetMatch) {
    const sub = budgetMatch[3];
    if (sub === 'transactions') return 'Budget · Transaktioner';
    if (sub === 'import') return 'Budget · Importer';
    if (sub === 'details') return 'Budget · Detaljer';
    return 'Budget · Kuvert';
  }
  return pathname;
}

function AdminOverlayConnected({ wizardFromContext, dataTypesFromContext }: { wizardFromContext: WizardInfo | null; dataTypesFromContext: DataTypeInfo[] }) {
  const { isAdmin, loading } = useAuth();
  const pathname = usePathname();

  if (loading || !isAdmin) return null;

  const pageName = resolvePageName(pathname);

  let label = pageName;
  if (wizardFromContext) {
    label = `${wizardFromContext.name} · Trin ${wizardFromContext.step}/${wizardFromContext.totalSteps}`;
    if (wizardFromContext.stepLabel) label += ` · ${wizardFromContext.stepLabel}`;
  }

  const incomeTypes = dataTypesFromContext.filter(t => t.kind === 'income');
  const expenseTypes = dataTypesFromContext.filter(t => t.kind === 'expense');
  const variableExpenseTypes = dataTypesFromContext.filter(t => t.kind === 'variable_expense');
  const savingsTypes = dataTypesFromContext.filter(t => t.kind === 'savings');
  const investmentTypes = dataTypesFromContext.filter(t => t.kind === 'investment');
  const frirumTypes = dataTypesFromContext.filter(t => t.kind === 'frirum');

  return (
    <div className="fixed top-2 right-3 z-[9999] pointer-events-none select-none flex flex-col items-end gap-1">
      <span className="text-label font-mono font-semibold text-red-600 bg-white/90 rounded px-2 py-1 shadow border border-red-300">
        {label}
      </span>
      {incomeTypes.length > 0 && (
        <span className="text-xs font-mono text-emerald-700 bg-white/90 rounded px-2 py-0.5 shadow border border-emerald-300">
          Indkomst: {incomeTypes.map(t => t.name).join(', ')}
        </span>
      )}
      {expenseTypes.length > 0 && (
        <span className="text-xs font-mono text-rose-700 bg-white/90 rounded px-2 py-0.5 shadow border border-rose-300">
          Faste udgifter: {expenseTypes.map(t => t.name).join(', ')}
        </span>
      )}
      {variableExpenseTypes.length > 0 && (
        <span className="text-xs font-mono text-orange-700 bg-white/90 rounded px-2 py-0.5 shadow border border-orange-300">
          Variable udgifter: {variableExpenseTypes.map(t => t.name).join(', ')}
        </span>
      )}
      {savingsTypes.length > 0 && (
        <span className="text-xs font-mono text-blue-700 bg-white/90 rounded px-2 py-0.5 shadow border border-blue-300">
          Opsparing: {savingsTypes.map(t => t.name).join(', ')}
        </span>
      )}
      {investmentTypes.length > 0 && (
        <span className="text-xs font-mono text-teal-700 bg-white/90 rounded px-2 py-0.5 shadow border border-teal-300">
          Investering: {investmentTypes.map(t => t.name).join(', ')}
        </span>
      )}
      {frirumTypes.length > 0 && (
        <span className="text-xs font-mono text-slate-700 bg-white/90 rounded px-2 py-0.5 shadow border border-slate-300">
          Frirum: {frirumTypes.map(t => t.name).join(' − ')}
        </span>
      )}
    </div>
  );
}

export function AdminLabelProvider({ children }: { children: React.ReactNode }) {
  const [wizard, setWizardState] = useState<WizardInfo | null>(null);
  const [dataTypes, setDataTypesState] = useState<DataTypeInfo[]>([]);
  const pathname = usePathname();

  const setWizard = useCallback((info: WizardInfo | null) => {
    setWizardState(info);
  }, []);

  const setDataTypes = useCallback((types: DataTypeInfo[]) => {
    setDataTypesState(types);
  }, []);

  useEffect(() => {
    setWizardState(null);
    setDataTypesState([]);
  }, [pathname]);

  return (
    <AdminLabelContext.Provider value={{ setWizard, setDataTypes }}>
      {children}
      <AdminOverlayConnected wizardFromContext={wizard} dataTypesFromContext={dataTypes} />
    </AdminLabelContext.Provider>
  );
}
