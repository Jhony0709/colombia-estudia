'use client';

/**
 * Reading preferences provider for accessibility.
 * SSOT: reference/03-ui/tokens.md (reading preferences)
 *
 * Manages user-configurable reading preferences and writes them
 * as CSS variables on the <html> element.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

export interface ReadingPreferences {
  fontScale: '1' | '1.15' | '1.3';
  lineHeight: '1.5' | '1.75' | '2';
  width: '68ch' | '56ch';
  contrast: 'normal' | 'high';
  motion: 'system' | 'reduced';
  transcriptAlwaysVisible: boolean;
}

interface AccessibilityPreferencesContextValue {
  preferences: ReadingPreferences;
  updatePreference: <K extends keyof ReadingPreferences>(
    key: K,
    value: ReadingPreferences[K]
  ) => void;
  /**
   * CORRECTION 12: Effective values after applying system preferences.
   * motionEffective returns 'reduced' if preference is 'system' and
   * prefers-reduced-motion matches.
   */
  motionEffective: 'full' | 'reduced';
  contrastEffective: 'normal' | 'high';
}

const defaultPreferences: ReadingPreferences = {
  fontScale: '1',
  lineHeight: '1.5',
  width: '68ch',
  contrast: 'normal',
  motion: 'system',
  transcriptAlwaysVisible: false,
};

const AccessibilityPreferencesContext = createContext<AccessibilityPreferencesContextValue | null>(
  null
);

interface Props {
  /** Initial preferences from user's Person.readingPreferences */
  initialPreferences?: Partial<ReadingPreferences> | null;
  children: ReactNode;
}

export function AccessibilityPreferencesProvider({ initialPreferences, children }: Props) {
  const [preferences, setPreferences] = useState<ReadingPreferences>({
    ...defaultPreferences,
    ...initialPreferences,
  });

  // Track system preferences
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [systemHighContrast, setSystemHighContrast] = useState(false);

  // Listen to system preferences
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');

    const updateMotion = () => setSystemReducedMotion(motionQuery.matches);
    const updateContrast = () => setSystemHighContrast(contrastQuery.matches);

    updateMotion();
    updateContrast();

    motionQuery.addEventListener('change', updateMotion);
    contrastQuery.addEventListener('change', updateContrast);

    return () => {
      motionQuery.removeEventListener('change', updateMotion);
      contrastQuery.removeEventListener('change', updateContrast);
    };
  }, []);

  // Compute effective values
  const motionEffective =
    preferences.motion === 'reduced' || (preferences.motion === 'system' && systemReducedMotion)
      ? 'reduced'
      : 'full';

  const contrastEffective =
    preferences.contrast === 'high' || systemHighContrast ? 'high' : 'normal';

  // Write CSS variables to <html>
  useEffect(() => {
    const html = document.documentElement;

    html.style.setProperty('--reading-font-scale', preferences.fontScale);
    html.style.setProperty('--reading-line-height', preferences.lineHeight);
    html.style.setProperty('--reading-width', preferences.width);
    html.style.setProperty('--reading-contrast', contrastEffective);
    html.style.setProperty('--reading-motion', motionEffective);

    html.dataset.transcriptVisible = String(preferences.transcriptAlwaysVisible);
  }, [preferences, motionEffective, contrastEffective]);

  const updatePreference = useCallback(
    <K extends keyof ReadingPreferences>(key: K, value: ReadingPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  return (
    <AccessibilityPreferencesContext.Provider
      value={{
        preferences,
        updatePreference,
        motionEffective,
        contrastEffective,
      }}
    >
      {children}
    </AccessibilityPreferencesContext.Provider>
  );
}

/**
 * Hook to access and update reading preferences.
 * Must be used within AccessibilityPreferencesProvider.
 */
export function useReadingPreferences(): AccessibilityPreferencesContextValue {
  const ctx = useContext(AccessibilityPreferencesContext);
  if (!ctx) {
    throw new Error('useReadingPreferences must be used within AccessibilityPreferencesProvider');
  }
  return ctx;
}
