'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuickExpense, updateQuickExpense } from '@/lib/quick-expense-service';

const DANISH_MONTHS_SHORT = [
  'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
];

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;

interface WheelColumnProps {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  getLabel?: (item: string, index: number) => string;
}

const PADDING_ITEMS = 2;

function WheelColumn({ items, selectedIndex, onSelect, getLabel }: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);
  const lastY = useRef(0);
  const velocity = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  const scrollToIndex = useCallback((index: number, animated = true) => {
    const el = containerRef.current;
    if (!el) return;
    const target = (index + PADDING_ITEMS) * ITEM_HEIGHT;
    if (animated) {
      el.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      el.scrollTop = target;
    }
  }, []);

  useEffect(() => {
    scrollToIndex(selectedIndex, false);
  }, [selectedIndex, scrollToIndex]);

  const snapToNearest = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rawIndex = Math.round(el.scrollTop / ITEM_HEIGHT) - PADDING_ITEMS;
    const clamped = Math.max(0, Math.min(items.length - 1, rawIndex));
    scrollToIndex(clamped);
    onSelect(clamped);
  }, [items.length, onSelect, scrollToIndex]);

  const handlePointerDown = (e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el) return;
    isDragging.current = true;
    startY.current = e.clientY;
    lastY.current = e.clientY;
    startScrollTop.current = el.scrollTop;
    velocity.current = 0;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const el = containerRef.current;
    if (!el) return;
    const delta = lastY.current - e.clientY;
    velocity.current = delta;
    lastY.current = e.clientY;
    el.scrollTop = startScrollTop.current + (startY.current - e.clientY);
  };

  const handlePointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const el = containerRef.current;
    if (!el) return;

    let momentum = velocity.current * 8;
    const decelerate = () => {
      if (Math.abs(momentum) < 0.5) { snapToNearest(); return; }
      el.scrollTop += momentum;
      momentum *= 0.88;
      animFrameRef.current = requestAnimationFrame(decelerate);
    };
    animFrameRef.current = requestAnimationFrame(decelerate);
  };

  const handleScroll = () => {
    if (isDragging.current) return;
  };

  const handleScrollEnd = useCallback(() => {
    if (!isDragging.current) snapToNearest();
  }, [snapToNearest]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(handleScrollEnd, 150);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); clearTimeout(timer); };
  }, [handleScrollEnd]);

  return (
    <div className="relative flex-1 overflow-hidden" style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}>
      <div
        className="absolute inset-x-0 pointer-events-none z-10"
        style={{
          top: 0,
          height: ITEM_HEIGHT * 2,
          background: 'linear-gradient(to bottom, white, rgba(255,255,255,0))',
        }}
      />
      <div
        className="absolute inset-x-0 pointer-events-none z-10"
        style={{
          bottom: 0,
          height: ITEM_HEIGHT * 2,
          background: 'linear-gradient(to top, white, rgba(255,255,255,0))',
        }}
      />
      <div
        className="absolute inset-x-0 pointer-events-none z-20 border-y border-emerald-300/60"
        style={{
          top: ITEM_HEIGHT * 2,
          height: ITEM_HEIGHT,
        }}
      />
      <div
        ref={containerRef}
        className="overflow-y-scroll scrollbar-hide select-none cursor-grab active:cursor-grabbing"
        style={{
          height: ITEM_HEIGHT * VISIBLE_ITEMS,
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onScroll={handleScroll}
      >
        {Array.from({ length: PADDING_ITEMS }).map((_, i) => (
          <div key={`pre-${i}`} style={{ height: ITEM_HEIGHT, scrollSnapAlign: 'start', flexShrink: 0 }} />
        ))}
        {items.map((item, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center justify-center text-sm font-medium transition-all duration-200',
              'select-none',
              i === selectedIndex
                ? 'text-foreground font-semibold text-base'
                : 'text-muted-foreground/50'
            )}
            style={{ height: ITEM_HEIGHT, scrollSnapAlign: 'start' }}
            onPointerDown={e => e.stopPropagation()}
            onClick={() => { scrollToIndex(i); onSelect(i); }}
          >
            {getLabel ? getLabel(item, i) : item}
          </div>
        ))}
        {Array.from({ length: PADDING_ITEMS }).map((_, i) => (
          <div key={`post-${i}`} style={{ height: ITEM_HEIGHT, scrollSnapAlign: 'start', flexShrink: 0 }} />
        ))}
      </div>
    </div>
  );
}

interface EditExpenseModalProps {
  expense: QuickExpense;
  year: number;
  month: number;
  onSave: (updated: QuickExpense) => void;
  onClose: () => void;
}

export default function EditExpenseModal({ expense, year, month, onSave, onClose }: EditExpenseModalProps) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayItems = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
  const monthItems = DANISH_MONTHS_SHORT;

  const parsedDate = expense.expense_date.split('-');
  const initDay = parseInt(parsedDate[2]) - 1;
  const initMonth = parseInt(parsedDate[1]) - 1;

  const [amountRaw, setAmountRaw] = useState(String(Number(expense.amount)));
  const [dayIndex, setDayIndex] = useState(initDay);
  const [monthIndex, setMonthIndex] = useState(initMonth);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => amountInputRef.current?.select(), 80);
  }, []);

  async function handleSave() {
    const parsed = parseFloat(amountRaw.replace(',', '.'));
    if (!parsed || parsed <= 0 || parsed > 999999) {
      setError('Beløb skal være mellem 1 og 999.999 kr.');
      return;
    }
    const d = dayIndex + 1;
    const m = monthIndex + 1;
    if (m < 1 || m > 12 || d < 1 || d > daysInMonth) {
      setError('Ugyldig dato.');
      return;
    }
    const newDate = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateQuickExpense(expense.id, parsed, newDate);
      onSave(updated);
    } catch {
      setError('Kunne ikke gemme ændringen. Prøv igen.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: 'editModalIn 260ms cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/40">
          <h2 className="text-sm font-semibold text-foreground">Rediger udgift</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">Beløb</p>
          <div className="relative">
            <input
              ref={amountInputRef}
              type="number"
              inputMode="decimal"
              value={amountRaw}
              onChange={e => { setAmountRaw(e.target.value); setError(null); }}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className={cn(
                'w-full h-12 rounded-xl border bg-background px-4 pr-14 text-xl font-semibold tracking-tight',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2',
                error ? 'border-red-300' : 'border-border'
              )}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground pointer-events-none">
              kr.
            </span>
          </div>
        </div>

        <div className="px-5 pt-3 pb-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">Dato</p>
          <div
            className="flex rounded-xl border border-border bg-white overflow-hidden"
            style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}
          >
            <WheelColumn
              items={dayItems}
              selectedIndex={dayIndex}
              onSelect={setDayIndex}
              getLabel={(item) => `${item}.`}
            />
            <div className="w-px bg-border/40 self-stretch my-3" />
            <WheelColumn
              items={monthItems}
              selectedIndex={monthIndex}
              onSelect={setMonthIndex}
            />
          </div>
        </div>

        {error && (
          <div className="px-5 pb-2">
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <X className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          </div>
        )}

        <div className="px-5 pt-2 pb-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-secondary transition-all duration-200"
          >
            Annuller
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'flex-1 h-11 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2',
              saving
                ? 'bg-emerald-500 text-white opacity-80 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-md active:scale-[0.97]'
            )}
          >
            {saving ? (
              <span className="animate-pulse">Gemmer…</span>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Gem
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes editModalIn {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
