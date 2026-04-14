'use client';

import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/number-helpers';
import { useSettings } from '@/lib/settings-context';
import { CardVisibilityToggle } from './card-visibility-toggle';
import { useHomeCard } from './home-card-context';
import type { HomeFinancials } from '@/lib/home-calculations';

function FinanceRow({
  label, value, sub, statusText, statusColor, positive = false,
  negative = false, dimmed = false, color, onTap, addLabel,
}: {
  label: string;
  value: number;
  sub: string;
  statusText?: string;
  statusColor?: 'emerald' | 'amber' | 'rose';
  positive?: boolean;
  negative?: boolean;
  dimmed?: boolean;
  color: string;
  onTap?: () => void;
  addLabel?: string;
}) {
  const fc = (v: number) => formatCurrency(v, { roundToHundreds: false, decimals: 0 });
  const statusColorMap = { emerald: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600' };
  const valueColor = dimmed ? 'text-muted-foreground/40'
    : negative ? 'text-foreground'
    : positive ? 'text-emerald-600'
    : 'text-foreground';

  const content = (
    <div className="px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-1.5 h-6 rounded-[8px] shrink-0" style={{ backgroundColor: dimmed ? '#d1d5db' : color }} />
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {sub && <p className="text-xs text-muted-foreground/60 leading-snug truncate">{sub}</p>}
        </div>
      </div>
      <div className="text-right shrink-0">
        {addLabel ? (
          <span className="text-xs font-semibold text-emerald-700 flex items-center gap-0.5">
            {addLabel} <ChevronRight className="h-3 w-3" />
          </span>
        ) : (
          <>
            <span className={`text-sm font-semibold tabular-nums ${valueColor}`}>
              {negative && value > 0 ? '−\u00a0' : ''}{fc(value)}
            </span>
            {statusText && (
              <p className={`text-xs font-medium ${statusColorMap[statusColor ?? 'emerald']}`}>{statusText}</p>
            )}
          </>
        )}
      </div>
    </div>
  );

  if (onTap) {
    return (
      <button onClick={onTap} className="w-full text-left hover:bg-black/[0.02] active:bg-black/[0.04] transition-colors">
        {content}
      </button>
    );
  }
  return <div>{content}</div>;
}

interface FinanceGridCardProps {
  financials: HomeFinancials;
  recipientCount: number;
  scenarioLabel: string;
  dimmed: boolean;
  onShowIncomeWizard: () => void;
  onShowVariableWizard: () => void;
}

export function FinanceGridCard({
  financials, recipientCount, scenarioLabel, dimmed, onShowIncomeWizard, onShowVariableWizard,
}: FinanceGridCardProps) {
  const router = useRouter();
  const { design } = useSettings();
  const { isAdmin } = useHomeCard();
  const fc = (v: number) => formatCurrency(v, { roundToHundreds: false, decimals: 0 });

  const { monthlyIncome, monthlyExpenses, monthlyVariable, monthlyInvestment, monthlyAvailable, fixedPct, variablePct, availableRate } = financials;

  return (
    <div className={cn(dimmed && 'opacity-50')}>
      {isAdmin && (
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">Finansoverblik</span>
          <CardVisibilityToggle cardKey="finance_grid" mode="inline" />
        </div>
      )}
      <div className="rounded-[8px] nuvio-card overflow-hidden">
        <div className="divide-y divide-black/[0.04]">
          <FinanceRow
            label="Indkomst"
            value={monthlyIncome}
            sub={monthlyIncome > 0 ? `${fc(monthlyIncome * 12)} pr. år` : 'Ikke angivet'}
            positive
            color="#10b981"
            onTap={monthlyIncome <= 0 ? onShowIncomeWizard : undefined}
          />
          <FinanceRow
            label="Faste udgifter"
            value={monthlyExpenses}
            sub={monthlyIncome > 0 ? `${Math.round(fixedPct * 100)}% af indkomst` : `${recipientCount} poster`}
            statusText={monthlyIncome > 0 ? (fixedPct < 0.45 ? 'Sund struktur' : fixedPct <= 0.55 ? 'Inden for normal grænse' : 'Høj binding') : undefined}
            statusColor={fixedPct < 0.45 ? 'emerald' : fixedPct <= 0.55 ? 'amber' : 'rose'}
            color="#94a3b8"
            negative
            onTap={() => router.push('/budgets')}
          />
          <FinanceRow
            label="Variable udgifter"
            value={monthlyVariable}
            sub={monthlyVariable > 0 ? (monthlyIncome > 0 ? `${Math.round(variablePct * 100)}% af indkomst` : 'Estimeret') : 'Ikke estimeret'}
            color="#94a3b8"
            negative={monthlyVariable > 0}
            dimmed={monthlyVariable <= 0}
            onTap={monthlyVariable <= 0 ? onShowVariableWizard : () => router.push('/variable-forbrug')}
            addLabel={monthlyVariable <= 0 ? 'Tilføj estimat' : undefined}
          />
          <FinanceRow
            label="Flow Opsparing"
            value={0}
            sub="Se Flow Opsparing"
            color="#f59e0b"
            negative={false}
            dimmed={true}
            onTap={() => router.push('/opsparing')}
            addLabel="Se Flow Opsparing"
          />
          {monthlyInvestment > 0 && (
            <FinanceRow
              label="Investering"
              value={monthlyInvestment}
              sub={scenarioLabel ? `Scenarie: ${scenarioLabel}` : 'Aktivt'}
              color={design.gradientFrom}
              negative
              onTap={() => router.push('/investering')}
            />
          )}
          <div className="px-4 py-3 flex items-center justify-between bg-secondary/20">
            <span className="text-sm font-semibold text-foreground">Frirum</span>
            <div className="text-right">
              <span className={`text-base font-bold tabular-nums ${monthlyAvailable >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {monthlyAvailable < 0 ? '−\u00a0' : ''}{fc(Math.abs(monthlyAvailable))}
              </span>
              {monthlyIncome > 0 && (
                <p className="text-xs text-muted-foreground/60">
                  {monthlyAvailable >= 0 ? `${Math.round(availableRate * 100)}% fleksibilitet` : 'Underskud'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
