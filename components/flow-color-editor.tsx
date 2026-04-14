'use client';

import { useState, useRef, useCallback } from 'react';
import { Save, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BadgeColorEditorProps {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  saving?: boolean;
}

interface CardColorEditorProps {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  saving?: boolean;
}

function parseHex(color: string): string {
  if (!color || color === 'transparent') return '#ffffff';
  if (color.startsWith('#')) return color;
  return '#ffffff';
}

function BadgeColorSwatch({ color }: { color: string }) {
  return (
    <div
      className="w-5 h-5 rounded-md border border-black/10 shrink-0"
      style={{ background: color }}
    />
  );
}

function CardGradientSwatch({ from, via, to }: { from: string; via: string; to: string }) {
  return (
    <div
      className="h-4 rounded-md border border-black/10"
      style={{ background: `linear-gradient(to right, ${from}, ${via}, ${to})` }}
    />
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1 flex-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          className="w-8 h-8 rounded-lg border border-black/10 shrink-0 transition-transform hover:scale-105 active:scale-95 relative overflow-hidden"
          style={{ background: value }}
          type="button"
        >
          <input
            ref={inputRef}
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </button>
        <input
          type="text"
          value={value.toUpperCase()}
          onChange={e => {
            const v = e.target.value;
            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v);
          }}
          maxLength={7}
          className={cn(
            'flex-1 h-9 rounded-xl border border-border bg-secondary/30 px-3 text-sm font-mono uppercase',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-1'
          )}
        />
      </div>
    </div>
  );
}

function parseBadgeTailwind(value: string): string {
  const bgMatch = value.match(/bg-\[([^\]]+)\]/);
  if (bgMatch) return bgMatch[1];
  const colorMap: Record<string, string> = {
    'bg-red-500': '#ef4444',
    'bg-amber-500': '#f59e0b',
    'bg-emerald-500': '#10b981',
    'bg-emerald-600': '#059669',
    'bg-teal-500': '#14b8a6',
    'bg-slate-700': '#334155',
    'bg-gray-500': '#6b7280',
    'bg-blue-500': '#3b82f6',
    'bg-orange-500': '#f97316',
  };
  for (const [cls, hex] of Object.entries(colorMap)) {
    if (value.includes(cls)) return hex;
  }
  return '#10b981';
}

function serializeBadgeTailwind(hex: string): string {
  return `bg-[${hex}]`;
}

export function BadgeColorEditor({ value, onSave, onCancel, saving }: BadgeColorEditorProps) {
  const [color, setColor] = useState(() => parseHex(parseBadgeTailwind(value)));

  return (
    <div className="space-y-3 p-3 rounded-2xl border border-border bg-secondary/10 min-w-[260px]">
      <div
        className="h-9 rounded-xl border border-black/10 flex items-center justify-center"
        style={{ background: color }}
      >
        <span className="text-xs font-semibold text-white drop-shadow-sm">Preview</span>
      </div>

      <ColorInput label="Farve" value={color} onChange={setColor} />

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
          onClick={() => onSave(serializeBadgeTailwind(color))}
          disabled={saving}
        >
          <Save className="h-3.5 w-3.5 mr-1" />
          Gem
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-xl" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function parseCardTailwind(value: string): { from: string; via: string; to: string } {
  const colorMap: Record<string, string> = {
    'red-50': '#fef2f2', 'rose-50': '#fff1f2',
    'amber-50': '#fffbeb', 'orange-50': '#fff7ed',
    'emerald-50': '#ecfdf5', 'teal-50': '#f0fdfa',
    'slate-50': '#f8fafc', 'gray-50': '#f9fafb',
    'white': '#ffffff',
    'yellow-50': '#fefce8',
  };
  const stops: string[] = [];
  const regex = /(?:from|via|to)-([a-z]+-\d+|white)(?:\/(\d+))?/g;
  let m;
  while ((m = regex.exec(value)) !== null) {
    const base = colorMap[m[1]] ?? '#ffffff';
    if (m[2]) {
      const opacity = parseInt(m[2]) / 100;
      const r = parseInt(base.slice(1, 3), 16);
      const g = parseInt(base.slice(3, 5), 16);
      const b = parseInt(base.slice(5, 7), 16);
      const blendedR = Math.round(r + (255 - r) * (1 - opacity));
      const blendedG = Math.round(g + (255 - g) * (1 - opacity));
      const blendedB = Math.round(b + (255 - b) * (1 - opacity));
      stops.push(`#${blendedR.toString(16).padStart(2, '0')}${blendedG.toString(16).padStart(2, '0')}${blendedB.toString(16).padStart(2, '0')}`);
    } else {
      stops.push(base);
    }
  }

  const hexMatch = value.match(/#([0-9a-fA-F]{6})/g) ?? [];
  hexMatch.forEach(h => { if (!stops.includes(h)) stops.push(h); });

  return {
    from: stops[0] ?? '#ecfdf5',
    via: stops[1] ?? '#ffffff',
    to: stops[2] ?? '#ffffff',
  };
}

function serializeCardStyle(from: string, via: string, to: string): string {
  return `bg-gradient-to-br from-[${from}] via-[${via}] to-[${to}] border-[${from}]/60`;
}

export function CardColorEditor({ value, onSave, onCancel, saving }: CardColorEditorProps) {
  const parsed = parseCardTailwind(value);
  const [from, setFrom] = useState(parseHex(parsed.from));
  const [via, setVia] = useState(parseHex(parsed.via));
  const [to, setTo] = useState(parseHex(parsed.to));

  return (
    <div className="space-y-3 p-3 rounded-2xl border border-border bg-secondary/10 min-w-[320px]">
      <div
        className="h-9 rounded-xl border border-black/10 flex items-center justify-center"
        style={{ background: `linear-gradient(to right, ${from}, ${via}, ${to})` }}
      >
        <span className="text-xs font-semibold text-slate-600 drop-shadow-sm">Preview</span>
      </div>

      <div className="flex items-start gap-3">
        <ColorInput label="Fra" value={from} onChange={setFrom} />
        <ColorInput label="Via" value={via} onChange={setVia} />
        <ColorInput label="Til" value={to} onChange={setTo} />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="flex-1 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
          onClick={() => onSave(serializeCardStyle(from, via, to))}
          disabled={saving}
        >
          <Save className="h-3.5 w-3.5 mr-1" />
          Gem
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-xl" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

const BADGE_COLOR_KEYS = new Set([
  'FLOW_COLOR_OVER_BADGE',
  'FLOW_COLOR_WARN_BADGE',
  'FLOW_COLOR_KURSEN_BADGE',
  'FLOW_COLOR_TEMPO_BADGE',
  'FLOW_COLOR_FLOW_BADGE',
]);

const CARD_COLOR_KEYS = new Set([
  'FLOW_COLOR_OVER_CARD',
  'FLOW_COLOR_WARN_CARD',
  'FLOW_COLOR_GOOD_CARD',
  'FLOW_COLOR_FLOW_CARD',
]);

export function isFlowColorKey(key: string): boolean {
  return BADGE_COLOR_KEYS.has(key) || CARD_COLOR_KEYS.has(key);
}

export function isFlowBadgeColorKey(key: string): boolean {
  return BADGE_COLOR_KEYS.has(key);
}

export function isFlowCardColorKey(key: string): boolean {
  return CARD_COLOR_KEYS.has(key);
}

export function FlowColorSwatch({ entryKey, value }: { entryKey: string; value: string }) {
  if (BADGE_COLOR_KEYS.has(entryKey)) {
    const color = parseBadgeTailwind(value);
    return <BadgeColorSwatch color={color} />;
  }
  if (CARD_COLOR_KEYS.has(entryKey)) {
    const { from, via, to } = parseCardTailwind(value);
    return (
      <div className="w-16">
        <CardGradientSwatch from={from} via={via} to={to} />
      </div>
    );
  }
  return null;
}
