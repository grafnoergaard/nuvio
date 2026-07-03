import type { CSSProperties } from 'react';
import type { CardDesignSettings, DesignSettings } from '@/lib/settings-context';

export const DEFAULT_VACATION_ACCENT = '#F6C126';
export const VACATION_CARD_STROKE = '#D5DEE0';

export function getVacationAccentColor(
  design?: Pick<DesignSettings, 'vacationAccentColor'> | null,
): string {
  return normalizeHex(design?.vacationAccentColor || DEFAULT_VACATION_ACCENT);
}

export function getVacationTopBarCard(card: CardDesignSettings, vacationAccent: string): CardDesignSettings {
  return {
    ...card,
    topBarGradientFrom: '#0E3B43',
    topBarGradientTo: getVacationAccentColor({ vacationAccentColor: vacationAccent }),
    topBarColor: getVacationAccentColor({ vacationAccentColor: vacationAccent }),
  };
}

export function normalizeHex(hex: string): string {
  const value = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^[0-9a-fA-F]{6}$/.test(value)) return `#${value}`;
  return DEFAULT_VACATION_ACCENT;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = normalizeHex(hex);
  return {
    r: parseInt(value.slice(1, 3), 16),
    g: parseInt(value.slice(3, 5), 16),
    b: parseInt(value.slice(5, 7), 16),
  };
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

export function mixWithWhite(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const ratio = Math.max(0, Math.min(1, amount));
  const mixed = [r, g, b].map((channel) => Math.round(channel + (255 - channel) * ratio));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function getVacationAccentMid(hex: string): string {
  return mixWithWhite(hex, 0.34);
}

export function getVacationAccentSoft(hex: string): string {
  return mixWithWhite(hex, 0.84);
}

export function getVacationCardSurfaceStyle(hex: string): CSSProperties {
  const vacationAccent = normalizeHex(hex);
  const vacationAccentSoft = getVacationAccentSoft(vacationAccent);
  return {
    background: `linear-gradient(to bottom right, ${withAlpha(vacationAccentSoft, 0.86)}, rgba(255,255,255,0.68), #ffffff)`,
    borderColor: VACATION_CARD_STROKE,
  };
}
