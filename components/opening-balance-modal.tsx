'use client';

import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OpeningBalanceModalProps {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function OpeningBalanceModal({ value, onChange, onSave, onClose }: OpeningBalanceModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
    >
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Start saldo</h2>
              <p className="text-muted-foreground text-sm mt-1">Hvad er din kontosaldo ved starten af planperioden?</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-6">
            <div className="bg-secondary/30 rounded-2xl p-4 text-sm text-muted-foreground leading-relaxed">
              Start saldoen er det beløb du har stående på kontoen, når din budgetperiode starter.
            </div>
            <div className="space-y-2">
              <Label htmlFor="ob-input" className="text-base font-medium">Saldo (kr.)</Label>
              <div className="relative">
                <Input
                  id="ob-input"
                  type="number"
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && onSave()}
                  className="text-lg h-12 pr-12 rounded-xl"
                  placeholder="0"
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">kr.</span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={onClose}>Annuller</Button>
              <Button className="flex-1 rounded-xl h-11" onClick={onSave}>
                <Check className="h-4 w-4 mr-2" />
                Gem saldo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
