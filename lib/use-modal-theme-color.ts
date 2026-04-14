'use client';

import { useEffect, useRef } from 'react';

function parseColor(value: string): [number, number, number] | null {
  const rgb = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];

  const hex = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1];
    return [
      parseInt(raw.slice(0, 2), 16),
      parseInt(raw.slice(2, 4), 16),
      parseInt(raw.slice(4, 6), 16),
    ];
  }

  return null;
}

function blendWithBlack([r, g, b]: [number, number, number], opacity: number) {
  const keep = 1 - opacity;
  return `rgb(${Math.round(r * keep)},${Math.round(g * keep)},${Math.round(b * keep)})`;
}

export function useModalThemeColor(active: boolean, overlayOpacity = 0.4) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;

    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }

    const previousContent = meta.content;
    const baseColor = parseColor(previousContent) ?? parseColor(getComputedStyle(document.body).backgroundColor) ?? [236, 253, 245];
    meta.content = blendWithBlack(baseColor, overlayOpacity);

    return () => {
      if (meta) meta.content = previousContent || '#f8f9f2';
    };
  }, [active, overlayOpacity]);
}

function hasOpenModalOverlay() {
  return Array.from(document.querySelectorAll<HTMLElement>('.fixed.inset-0')).some((element) => {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.pointerEvents !== 'none';
  });
}

export function useGlobalModalThemeColor(overlayOpacity = 0.4) {
  const previousContentRef = useRef<string | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }

    function syncThemeColor() {
      if (!meta) return;
      const hasModal = hasOpenModalOverlay();

      if (hasModal && !activeRef.current) {
        previousContentRef.current = meta.content;
        const baseColor = parseColor(meta.content) ?? parseColor(getComputedStyle(document.body).backgroundColor) ?? [236, 253, 245];
        meta.content = blendWithBlack(baseColor, overlayOpacity);
        activeRef.current = true;
      }

      if (!hasModal && activeRef.current) {
        meta.content = previousContentRef.current || '#f8f9f2';
        previousContentRef.current = null;
        activeRef.current = false;
      }
    }

    const observer = new MutationObserver(syncThemeColor);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    syncThemeColor();

    return () => {
      observer.disconnect();
      if (activeRef.current && meta) {
        meta.content = previousContentRef.current || '#f8f9f2';
      }
      previousContentRef.current = null;
      activeRef.current = false;
    };
  }, [overlayOpacity]);
}
