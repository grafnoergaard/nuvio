'use client';

import { useEffect } from 'react';
import { useSettings } from '@/lib/settings-context';

function hexToHsl(hex: string): string {
  let r = 0, g = 0, b = 0;
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length >= 6) {
    r = parseInt(clean.substring(0, 2), 16);
    g = parseInt(clean.substring(2, 4), 16);
    b = parseInt(clean.substring(4, 6), 16);
  }

  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function DesignApplier() {
  const { design } = useSettings();

  useEffect(() => {
    const root = document.documentElement;

    root.style.setProperty('--primary', hexToHsl(design.primaryColor));
    root.style.setProperty('--accent', hexToHsl(design.accentColor));
    root.style.setProperty('--background', hexToHsl(design.backgroundColor));
    root.style.setProperty('--foreground', hexToHsl(design.textColor));
    root.style.setProperty('--destructive', hexToHsl(design.minusColor));
    root.style.setProperty('--card-foreground', hexToHsl(design.textColor));

    root.style.setProperty('--design-gradient-from', design.gradientFrom);
    root.style.setProperty('--design-gradient-to', design.gradientTo);
    root.style.setProperty('--design-card1-from', design.card1GradientFrom);
    root.style.setProperty('--design-card1-to', design.card1GradientTo);
    root.style.setProperty('--design-card2-from', design.card2GradientFrom);
    root.style.setProperty('--design-card2-to', design.card2GradientTo);
    root.style.setProperty('--design-card3-from', design.card3GradientFrom);
    root.style.setProperty('--design-card3-to', design.card3GradientTo);
  }, [design]);

  return null;
}
