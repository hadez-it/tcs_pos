import { useState, useEffect, useCallback } from 'react';

export const UI_SCALE_STORAGE_KEY = 'mibayate_ui_scale';
export const DEFAULT_UI_SCALE = 1.0;
export const MIN_UI_SCALE = 0.8;
export const MAX_UI_SCALE = 1.3;
export const STEP_UI_SCALE = 0.05;

export interface UiScalePreset {
  id: string;
  label: string;
  value: number;
  description: string;
}

export const UI_SCALE_PRESETS: UiScalePreset[] = [
  { id: 'compact', label: 'Compact', value: 0.85, description: '85% — Fits more content' },
  { id: 'small', label: 'Small', value: 0.90, description: '90% — Reduced scale' },
  { id: 'default', label: 'Default', value: 1.00, description: '100% — Standard layout' },
  { id: 'large', label: 'Large', value: 1.10, description: '110% — Enhanced readability' },
  { id: 'xlarge', label: 'Extra Large', value: 1.20, description: '120% — Large touch targets' },
];

export const applyUiScale = (scale: number): number => {
  const clamped = Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, Math.round(scale * 100) / 100));
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--ui-scale', String(clamped));
    root.setAttribute('data-ui-scale', String(clamped));
    (root.style as any).zoom = String(clamped);
  }
  return clamped;
};

export const getStoredUiScale = (): number => {
  if (typeof window === 'undefined') return DEFAULT_UI_SCALE;
  try {
    const stored = localStorage.getItem(UI_SCALE_STORAGE_KEY);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= MIN_UI_SCALE && parsed <= MAX_UI_SCALE) {
        return Math.round(parsed * 100) / 100;
      }
    }
  } catch {
    return DEFAULT_UI_SCALE;
  }
  return DEFAULT_UI_SCALE;
};

export const saveUiScale = (scale: number): number => {
  const applied = applyUiScale(scale);
  try {
    localStorage.setItem(UI_SCALE_STORAGE_KEY, String(applied));
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ui-scale-change', { detail: { scale: applied } }));
  }
  return applied;
};

export const initUiScale = (): number => {
  const current = getStoredUiScale();
  return applyUiScale(current);
};

export const useUiScale = () => {
  const [scale, setScaleState] = useState<number>(() => getStoredUiScale());

  useEffect(() => {
    const handleScaleChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ scale: number }>;
      if (customEvent.detail && typeof customEvent.detail.scale === 'number') {
        setScaleState(customEvent.detail.scale);
      } else {
        setScaleState(getStoredUiScale());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === UI_SCALE_STORAGE_KEY) {
        const next = getStoredUiScale();
        setScaleState(next);
        applyUiScale(next);
      }
    };

    window.addEventListener('ui-scale-change', handleScaleChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('ui-scale-change', handleScaleChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const updateScale = useCallback((newScale: number) => {
    const saved = saveUiScale(newScale);
    setScaleState(saved);
  }, []);

  const resetScale = useCallback(() => {
    updateScale(DEFAULT_UI_SCALE);
  }, [updateScale]);

  return {
    scale,
    setScale: updateScale,
    resetScale,
    presets: UI_SCALE_PRESETS,
    minScale: MIN_UI_SCALE,
    maxScale: MAX_UI_SCALE,
    stepScale: STEP_UI_SCALE,
  };
};
