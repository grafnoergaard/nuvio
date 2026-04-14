'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTypographyInspector } from '@/lib/typography-inspector-context';
import { useTypography } from '@/lib/typography-context';
import { DEFAULT_TYPOGRAPHY_TOKENS } from '@/lib/typography-tokens';
import { X, Check, ChevronDown, Save, RotateCcw, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface TooltipState {
  x: number;
  y: number;
  currentRoleKey: string;
  currentRoleLabel: string;
  size: string;
  weight: string;
}

interface PendingChange {
  fromKey: string;
  fromLabel: string;
  toKey: string;
  toLabel: string;
  oldValue: string;
  newValue: string;
}

const ROLE_ORDER = [
  { key: 'font-size-caption',    label: 'Caption'    },
  { key: 'font-size-label',      label: 'Label'      },
  { key: 'font-size-body-sm',    label: 'Body SM'    },
  { key: 'font-size-body',       label: 'Body'       },
  { key: 'font-size-body-lg',    label: 'Body LG'    },
  { key: 'font-size-heading-sm', label: 'Heading SM' },
  { key: 'font-size-heading',    label: 'Heading'    },
  { key: 'font-size-heading-lg', label: 'Heading LG' },
  { key: 'font-size-display',    label: 'Display'    },
];

function resolveRoleKey(tokens: Record<string, string>, computedSize: number): string {
  let bestKey = 'font-size-caption';
  let bestDiff = Infinity;
  for (const role of ROLE_ORDER) {
    const tokenVal = tokens[role.key] ?? DEFAULT_TYPOGRAPHY_TOKENS[role.key];
    const diff = Math.abs(computedSize - parseFloat(tokenVal));
    if (diff < bestDiff) { bestDiff = diff; bestKey = role.key; }
  }
  return bestKey;
}

function weightLabel(w: number): string {
  if (w <= 350) return 'Thin';
  if (w <= 450) return 'Regular';
  if (w <= 550) return 'Medium';
  if (w <= 650) return 'Semibold';
  if (w <= 750) return 'Bold';
  if (w <= 850) return 'ExtraBold';
  return 'Black';
}

export function TypographyInspector() {
  const { active, toggle } = useTypographyInspector();
  const { tokens, previewToken, saveTokens } = useTypography();

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [locked, setLocked] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [saving, setSaving] = useState(false);

  const rafRef = useRef<number | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const badgeRef = useRef<HTMLDivElement | null>(null);
  const pendingPanelRef = useRef<HTMLDivElement | null>(null);
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;

  const buildTooltipFromElement = useCallback((el: HTMLElement, x: number, y: number): TooltipState | null => {
    const style = window.getComputedStyle(el);
    const size = parseFloat(style.fontSize);
    const weight = parseInt(style.fontWeight, 10) || 400;
    if (!size) return null;
    const currentRoleKey = resolveRoleKey(tokensRef.current, size);
    const currentRoleLabel = ROLE_ORDER.find(r => r.key === currentRoleKey)?.label ?? '—';
    return { x, y, currentRoleKey, currentRoleLabel, size: `${Math.round(size)}px`, weight: `${weight} · ${weightLabel(weight)}` };
  }, []);

  const isInspectorElement = useCallback((target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;
    return !!(
      tooltipRef.current?.contains(target) ||
      badgeRef.current?.contains(target) ||
      pendingPanelRef.current?.contains(target)
    );
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (locked) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const target = e.target as HTMLElement;
      if (isInspectorElement(target)) return;
      const state = buildTooltipFromElement(target, e.clientX, e.clientY);
      setTooltip(state);
    });
  }, [locked, isInspectorElement, buildTooltipFromElement]);

  const handleMouseLeave = useCallback(() => {
    if (!locked) setTooltip(null);
  }, [locked]);

  const handleClick = useCallback((e: MouseEvent) => {
    if (isInspectorElement(e.target)) return;
    if (locked) {
      setLocked(false);
      setDropdownOpen(false);
      setTooltip(null);
      return;
    }
    const target = e.target as HTMLElement;
    const state = buildTooltipFromElement(target, e.clientX, e.clientY);
    if (state) {
      e.preventDefault();
      e.stopPropagation();
      setTooltip(state);
      setLocked(true);
    }
  }, [locked, isInspectorElement, buildTooltipFromElement]);

  useEffect(() => {
    if (!active) {
      setTooltip(null);
      setLocked(false);
      setDropdownOpen(false);
      return;
    }
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('click', handleClick, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, handleMouseMove, handleMouseLeave, handleClick]);

  function handleRoleSelect(toRole: { key: string; label: string }) {
    if (!tooltip) return;
    const fromKey = tooltip.currentRoleKey;
    const fromLabel = tooltip.currentRoleLabel;

    if (fromKey === toRole.key) {
      setDropdownOpen(false);
      setLocked(false);
      setTooltip(null);
      return;
    }

    const oldValue = tokensRef.current[fromKey] ?? DEFAULT_TYPOGRAPHY_TOKENS[fromKey];
    const newValue = tokensRef.current[toRole.key] ?? DEFAULT_TYPOGRAPHY_TOKENS[toRole.key];
    previewToken(fromKey, newValue);

    setPendingChanges(prev => {
      const existingIdx = prev.findIndex(p => p.fromKey === fromKey);
      const change: PendingChange = { fromKey, fromLabel, toKey: toRole.key, toLabel: toRole.label, oldValue, newValue };
      if (existingIdx >= 0) { const next = [...prev]; next[existingIdx] = change; return next; }
      return [...prev, change];
    });

    setDropdownOpen(false);
    setLocked(false);
    setTooltip(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveTokens(tokensRef.current);
      toast.success(`${pendingChanges.length} token-ændring${pendingChanges.length !== 1 ? 'er' : ''} gemt`);
      setPendingChanges([]);
    } catch {
      toast.error('Kunne ikke gemme ændringer');
    } finally {
      setSaving(false);
    }
  }

  function handleRevert() {
    pendingChanges.forEach(c => previewToken(c.fromKey, c.oldValue));
    setPendingChanges([]);
  }

  if (!active) return null;

  const tooltipLeft = tooltip ? Math.min(tooltip.x + 14, window.innerWidth - 210) : 0;
  const tooltipTop = tooltip ? Math.max(tooltip.y - 10, 8) : 0;

  return (
    <>
      <div
        ref={badgeRef}
        className="fixed bottom-20 right-4 z-[9999] flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg border"
        style={{ background: 'linear-gradient(to right, #0d9488, #10b981)', color: '#fff', borderColor: 'rgba(255,255,255,0.2)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
        Typo Inspector
        {pendingChanges.length > 0 && (
          <span className="ml-0.5 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
            {pendingChanges.length}
          </span>
        )}
        <button onClick={toggle} className="ml-1 opacity-70 hover:opacity-100 transition-opacity" aria-label="Luk inspector">
          <X className="h-3 w-3" />
        </button>
      </div>

      {pendingChanges.length > 0 && (
        <div
          ref={pendingPanelRef}
          className="fixed bottom-32 right-4 z-[9999] rounded-2xl shadow-xl border overflow-hidden"
          style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(12px)', borderColor: 'rgba(255,255,255,0.08)', minWidth: 240 }}
        >
          <div className="px-3 pt-2.5 pb-1">
            <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">Afventende ændringer</p>
          </div>
          <div className="px-3 pb-2 space-y-1.5">
            {pendingChanges.map(c => (
              <div key={c.fromKey} className="flex items-center gap-2">
                <span className="text-white/70 text-xs font-medium">{c.fromLabel}</span>
                <span className="text-white/30 text-xs">→</span>
                <span className="text-emerald-400 text-xs font-semibold">{c.toLabel}</span>
                <span className="ml-auto text-white/25 text-[10px] font-mono whitespace-nowrap">{c.oldValue} → {c.newValue}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5 px-3 pb-3 pt-1">
            <button
              onClick={handleRevert}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white/90 border border-white/10 hover:border-white/20 transition-all"
            >
              <RotateCcw className="h-3 w-3" />
              Fortryd
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-white border transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(to right, #0d9488, #10b981)', borderColor: 'rgba(255,255,255,0.15)' }}
            >
              <Save className="h-3 w-3" />
              {saving ? 'Gemmer...' : 'Gem alt'}
            </button>
          </div>
        </div>
      )}

      {tooltip && (
        <div
          ref={tooltipRef}
          className="fixed z-[10000]"
          style={{ left: tooltipLeft, top: tooltipTop }}
        >
          <div
            className="rounded-xl shadow-xl border text-left overflow-hidden transition-all"
            style={{
              background: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(8px)',
              borderColor: locked ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.08)',
              minWidth: 170,
              boxShadow: locked ? '0 0 0 1px rgba(16,185,129,0.25), 0 8px 24px rgba(0,0,0,0.4)' : undefined,
            }}
          >
            {!locked ? (
              <div className="px-3 py-2.5">
                <div className="text-white font-semibold text-sm leading-tight">{tooltip.currentRoleLabel}</div>
                <div className="text-white/50 text-xs mt-0.5 font-mono">{tooltip.size}</div>
                <div className="text-white/30 text-xs mt-0.5">{tooltip.weight}</div>
                <div className="mt-2 pt-2 border-t border-white/8 text-[10px] text-white/30 font-medium">
                  Klik for at låse
                </div>
              </div>
            ) : !dropdownOpen ? (
              <div>
                <div className="px-3 pt-2.5 pb-2">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="text-white font-semibold text-sm leading-tight">{tooltip.currentRoleLabel}</div>
                    <Lock className="h-3 w-3 text-emerald-400 shrink-0" />
                  </div>
                  <div className="text-white/50 text-xs font-mono">{tooltip.size}</div>
                  <div className="text-white/30 text-xs mt-0.5">{tooltip.weight}</div>
                </div>
                <button
                  className="w-full flex items-center justify-between px-3 py-2.5 border-t border-white/8 hover:bg-white/5 transition-colors group"
                  onClick={(e) => { e.stopPropagation(); setDropdownOpen(true); }}
                >
                  <span className="text-[11px] text-white/50 font-medium group-hover:text-white/80 transition-colors">
                    Ændr rolle
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-white/40 group-hover:text-white/70 transition-colors" />
                </button>
              </div>
            ) : (
              <div>
                <div className="px-3 pt-2.5 pb-1">
                  <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">
                    Sæt {tooltip.currentRoleLabel} til
                  </p>
                </div>
                <div className="pb-1">
                  {ROLE_ORDER.map(role => {
                    const roleValue = tokensRef.current[role.key] ?? DEFAULT_TYPOGRAPHY_TOKENS[role.key];
                    const isCurrent = role.key === tooltip.currentRoleKey;
                    return (
                      <button
                        key={role.key}
                        onClick={(e) => { e.stopPropagation(); handleRoleSelect(role); }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                          isCurrent ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="text-sm font-medium">{role.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white/30 text-xs font-mono">{roleValue}</span>
                          {isCurrent && <Check className="h-3 w-3 text-emerald-400 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
