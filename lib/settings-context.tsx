'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface Settings {
  roundToHundreds: boolean;
  hideDecimals: boolean;
  colorizeAmounts: boolean;
}

export interface CardDesignSettings {
  borderRadius: number;
  borderWidth: number;
  shadow: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  topBarHeight: number;
  topBarStyle: 'gradient' | 'solid' | 'none';
  topBarColor: string;
  bgOpacity: number;
}

export interface PageDesignSettings {
  maxWidth: number;
  paddingX: number;
  paddingY: number;
  cardGap: number;
  gridCols: number;
  gridColsSmall: number;
}

export interface DesignSettings {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  minusColor: string;
  gradientFrom: string;
  gradientTo: string;
  card1GradientFrom: string;
  card1GradientTo: string;
  card2GradientFrom: string;
  card2GradientTo: string;
  card3GradientFrom: string;
  card3GradientTo: string;
  logoUrl: string;
  mobileNavIconUrl: string;
  cardSmall: CardDesignSettings;
  cardMedium: CardDesignSettings;
  cardLarge: CardDesignSettings;
  page: PageDesignSettings;
}

interface SettingsContextValue {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
  design: DesignSettings;
  updateDesign: <K extends keyof DesignSettings>(key: K, value: DesignSettings[K]) => void;
  updateCardDesign: (size: 'cardSmall' | 'cardMedium' | 'cardLarge', key: keyof CardDesignSettings, value: CardDesignSettings[keyof CardDesignSettings]) => void;
  updatePageDesign: (key: keyof PageDesignSettings, value: PageDesignSettings[keyof PageDesignSettings]) => void;
  resetDesign: () => void;
}

const DEFAULT_SETTINGS: Settings = {
  roundToHundreds: false,
  hideDecimals: false,
  colorizeAmounts: false,
};

export const DEFAULT_CARD_SMALL: CardDesignSettings = {
  borderRadius: 24,
  borderWidth: 1,
  shadow: 'sm',
  topBarHeight: 0,
  topBarStyle: 'none',
  topBarColor: '#2ED3A7',
  bgOpacity: 100,
};

export const DEFAULT_CARD_MEDIUM: CardDesignSettings = {
  borderRadius: 24,
  borderWidth: 1,
  shadow: 'sm',
  topBarHeight: 4,
  topBarStyle: 'gradient',
  topBarColor: '#2ED3A7',
  bgOpacity: 100,
};

export const DEFAULT_CARD_LARGE: CardDesignSettings = {
  borderRadius: 24,
  borderWidth: 1,
  shadow: 'sm',
  topBarHeight: 4,
  topBarStyle: 'gradient',
  topBarColor: '#2ED3A7',
  bgOpacity: 100,
};

export const DEFAULT_PAGE_DESIGN: PageDesignSettings = {
  maxWidth: 1024,
  paddingX: 32,
  paddingY: 32,
  cardGap: 12,
  gridCols: 3,
  gridColsSmall: 2,
};

export const DEFAULT_DESIGN: DesignSettings = {
  primaryColor: '#0E3B43',
  accentColor: '#2ED3A7',
  backgroundColor: '#F6F4EF',
  textColor: '#1E1E1E',
  minusColor: '#E45C5C',
  gradientFrom: '#0E3B43',
  gradientTo: '#2ED3A7',
  card1GradientFrom: '#E45C5C',
  card1GradientTo: '#f87171',
  card2GradientFrom: '#2ED3A7',
  card2GradientTo: '#10b981',
  card3GradientFrom: '#3b82f6',
  card3GradientTo: '#38bdf8',
  logoUrl: '/nuvio copy.png',
  mobileNavIconUrl: '/nuvio_copy.png',
  cardSmall: DEFAULT_CARD_SMALL,
  cardMedium: DEFAULT_CARD_MEDIUM,
  cardLarge: DEFAULT_CARD_LARGE,
  page: DEFAULT_PAGE_DESIGN,
};

const STORAGE_PREFIX = 'settings.';
const DESIGN_PREFIX = 'design.';
const CARD_DESIGN_PREFIX = 'card_design.';
const PAGE_DESIGN_KEY = 'page_design';

const SettingsContext = createContext<SettingsContextValue | null>(null);

function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  return {
    roundToHundreds: localStorage.getItem(`${STORAGE_PREFIX}roundToHundreds`) === 'true',
    hideDecimals: localStorage.getItem(`${STORAGE_PREFIX}hideDecimals`) === 'true',
    colorizeAmounts: localStorage.getItem(`${STORAGE_PREFIX}colorizeAmounts`) === 'true',
  };
}

function loadCardDesign(size: 'cardSmall' | 'cardMedium' | 'cardLarge', defaults: CardDesignSettings): CardDesignSettings {
  if (typeof window === 'undefined') return defaults;
  const stored = localStorage.getItem(`${CARD_DESIGN_PREFIX}${size}`);
  if (!stored) return defaults;
  try {
    return { ...defaults, ...JSON.parse(stored) };
  } catch {
    return defaults;
  }
}

function loadPageDesign(): PageDesignSettings {
  if (typeof window === 'undefined') return DEFAULT_PAGE_DESIGN;
  const stored = localStorage.getItem(PAGE_DESIGN_KEY);
  if (!stored) return DEFAULT_PAGE_DESIGN;
  try {
    const parsed = { ...DEFAULT_PAGE_DESIGN, ...JSON.parse(stored) };
    parsed.gridColsSmall = Math.min(parsed.gridColsSmall, 2);
    return parsed;
  } catch {
    return DEFAULT_PAGE_DESIGN;
  }
}

function loadDesign(): DesignSettings {
  if (typeof window === 'undefined') return DEFAULT_DESIGN;

  const result = { ...DEFAULT_DESIGN };
  (Object.keys(DEFAULT_DESIGN) as (keyof DesignSettings)[]).forEach((key) => {
    if (key === 'cardSmall' || key === 'cardMedium' || key === 'cardLarge' || key === 'page') return;
    const stored = localStorage.getItem(`${DESIGN_PREFIX}${key}`);
    if (stored !== null) {
      (result as any)[key] = stored;
    }
  });
  result.cardSmall = loadCardDesign('cardSmall', DEFAULT_CARD_SMALL);
  result.cardMedium = loadCardDesign('cardMedium', DEFAULT_CARD_MEDIUM);
  result.cardLarge = loadCardDesign('cardLarge', DEFAULT_CARD_LARGE);
  result.page = loadPageDesign();
  return result;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [design, setDesign] = useState<DesignSettings>(DEFAULT_DESIGN);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setDesign(loadDesign());
    setMounted(true);
  }, []);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, String(value));
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    Object.keys(DEFAULT_SETTINGS).forEach(key => {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    });
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const updateDesign = useCallback(<K extends keyof DesignSettings>(key: K, value: DesignSettings[K]) => {
    setDesign(prev => {
      const next = { ...prev, [key]: value };
      if (key !== 'cardSmall' && key !== 'cardMedium' && key !== 'cardLarge' && key !== 'page') {
        localStorage.setItem(`${DESIGN_PREFIX}${key}`, String(value));
      }
      return next;
    });
  }, []);

  const updatePageDesign = useCallback((
    key: keyof PageDesignSettings,
    value: PageDesignSettings[keyof PageDesignSettings],
  ) => {
    setDesign(prev => {
      const updated = { ...prev.page, [key]: value };
      const next = { ...prev, page: updated };
      localStorage.setItem(PAGE_DESIGN_KEY, JSON.stringify(updated));
      return next;
    });
  }, []);

  const updateCardDesign = useCallback((
    size: 'cardSmall' | 'cardMedium' | 'cardLarge',
    key: keyof CardDesignSettings,
    value: CardDesignSettings[keyof CardDesignSettings],
  ) => {
    setDesign(prev => {
      const updated = { ...prev[size], [key]: value };
      const next = { ...prev, [size]: updated };
      localStorage.setItem(`${CARD_DESIGN_PREFIX}${size}`, JSON.stringify(updated));
      return next;
    });
  }, []);

  const resetDesign = useCallback(() => {
    (Object.keys(DEFAULT_DESIGN) as (keyof DesignSettings)[]).forEach(key => {
      if (key === 'cardSmall' || key === 'cardMedium' || key === 'cardLarge' || key === 'page') return;
      localStorage.removeItem(`${DESIGN_PREFIX}${key}`);
    });
    localStorage.removeItem(`${CARD_DESIGN_PREFIX}cardSmall`);
    localStorage.removeItem(`${CARD_DESIGN_PREFIX}cardMedium`);
    localStorage.removeItem(`${CARD_DESIGN_PREFIX}cardLarge`);
    localStorage.removeItem(PAGE_DESIGN_KEY);
    setDesign(DEFAULT_DESIGN);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings, design, updateDesign, updateCardDesign, updatePageDesign, resetDesign }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    return {
      settings: DEFAULT_SETTINGS,
      updateSetting: () => {},
      resetSettings: () => {},
      design: DEFAULT_DESIGN,
      updateDesign: () => {},
      updateCardDesign: () => {},
      updatePageDesign: () => {},
      resetDesign: () => {},
    } as SettingsContextValue;
  }
  return ctx;
}

export function getCardStyle(card: CardDesignSettings, gradientFrom?: string, gradientTo?: string): React.CSSProperties {
  const shadows: Record<string, string> = {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0,0,0,0.05)',
    md: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
    lg: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
    xl: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
  };
  return {
    borderRadius: `${card.borderRadius}px`,
    borderWidth: `${card.borderWidth}px`,
    borderStyle: 'solid',
    borderColor: 'hsl(var(--border))',
    boxShadow: shadows[card.shadow],
    overflow: 'hidden',
  };
}

export function getTopBarStyle(card: CardDesignSettings, gradientFrom: string, gradientTo: string): React.CSSProperties | null {
  if (card.topBarStyle === 'none' || card.topBarHeight === 0) return null;
  if (card.topBarStyle === 'gradient') {
    return {
      height: `${card.topBarHeight}px`,
      background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})`,
      flexShrink: 0,
    };
  }
  return {
    height: `${card.topBarHeight}px`,
    background: card.topBarColor,
    flexShrink: 0,
  };
}
