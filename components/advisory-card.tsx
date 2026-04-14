'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/number-helpers';
import type { AdvisoryResult } from '@/lib/advisory-engine';

interface AdvisoryCardProps {
  result: AdvisoryResult;
  monthlyIncome: number;
}

function formatMonths(months: number): string {
  if (months <= 0) return '';
  if (months < 12) return `${months} mdr.`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} år`;
  return `${years} år ${rem} mdr.`;
}

function fmtPct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function fmtKr(v: number): string {
  return formatCurrency(Math.round(v), { roundToHundreds: false, decimals: 0 });
}

export function AdvisoryCard({ result, monthlyIncome }: AdvisoryCardProps) {
  const [open, setOpen] = useState(false);

  const currentExpenseRate = (monthlyIncome - result.impact.newExpenseRate * monthlyIncome + result.totalReduction) / monthlyIncome;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-sm text-muted-foreground font-medium">
                Nuvio identificerer strukturelt potentiale
              </span>
            </div>
            {open
              ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            }
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-5 pb-6 pt-1 border-t border-border/50">

            <div className="flex items-center gap-2 mb-4 mt-4">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-base font-semibold text-foreground tracking-tight">Nuvio Anbefaler</span>
            </div>

            {result.incomeAdjustmentFallback ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                Dine udgiftskategorier er inden for benchmark. For at styrke opsparingsraten yderligere kan det overvejes at øge indkomsten eller justere bidraget til dine mål.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                  Der er primært potentiale i følgende områder:
                </p>

                <div className="space-y-0 rounded-xl border border-border overflow-hidden mb-5">
                  {result.breakdown.map((item, i) => (
                    <div
                      key={item.category}
                      className={`flex items-center justify-between px-4 py-3 ${i < result.breakdown.length - 1 ? 'border-b border-border' : ''}`}
                    >
                      <span className="text-sm font-medium text-foreground">{item.category}</span>
                      <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                        − {fmtKr(item.reduction)}/md.
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm text-muted-foreground">Samlet justering</span>
                  <span className="text-sm font-bold text-foreground tabular-nums">
                    {fmtKr(result.totalReduction)}/md.
                  </span>
                </div>

                <div className="rounded-xl bg-muted/40 border border-border/60 px-4 py-4 mb-6 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-3">
                    Forventet effekt
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Udgiftsandel</span>
                    <div className="flex items-center gap-2 text-xs tabular-nums">
                      <span className="text-muted-foreground/70">{fmtPct(result.impact.newExpenseRate + result.totalReduction / monthlyIncome)}</span>
                      <span className="text-muted-foreground/40">→</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{fmtPct(result.impact.newExpenseRate)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Opsparingsrate</span>
                    <div className="flex items-center gap-2 text-xs tabular-nums">
                      <span className="text-muted-foreground/70">{fmtPct(result.impact.newSavingsRate - result.totalReduction / monthlyIncome)}</span>
                      <span className="text-muted-foreground/40">→</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{fmtPct(result.impact.newSavingsRate)}</span>
                    </div>
                  </div>

                  {result.impact.monthsSaved !== null && result.impact.monthsSaved > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Mål fremskyndes</span>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatMonths(result.impact.monthsSaved)} tidligere
                      </span>
                    </div>
                  )}
                </div>

                <Button variant="outline" size="sm" className="rounded-xl text-sm font-medium">
                  Simulér justering
                </Button>
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
