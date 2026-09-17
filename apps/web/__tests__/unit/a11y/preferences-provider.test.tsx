/** @jest-environment jsdom */
/**
 * Tests for lib/a11y/preferences-provider.tsx
 */

import React, { type ReactNode } from 'react';
import { render, screen, act, renderHook } from '@testing-library/react';
import {
  AccessibilityPreferencesProvider,
  useReadingPreferences,
} from '@/lib/a11y/preferences-provider';

// Helper wrapper
function wrapper({ children }: { children: ReactNode }) {
  return <AccessibilityPreferencesProvider>{children}</AccessibilityPreferencesProvider>;
}

describe('AccessibilityPreferencesProvider', () => {
  // Mock matchMedia
  let mockReducedMotion = false;
  let mockHighContrast = false;
  let motionListeners: Array<(e: { matches: boolean }) => void> = [];
  let contrastListeners: Array<(e: { matches: boolean }) => void> = [];

  beforeEach(() => {
    mockReducedMotion = false;
    mockHighContrast = false;
    motionListeners = [];
    contrastListeners = [];

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => {
        if (query === '(prefers-reduced-motion: reduce)') {
          return {
            matches: mockReducedMotion,
            addEventListener: (_: string, fn: (e: { matches: boolean }) => void) =>
              motionListeners.push(fn),
            removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
              motionListeners = motionListeners.filter((l) => l !== fn);
            },
          };
        }
        if (query === '(prefers-contrast: more)') {
          return {
            matches: mockHighContrast,
            addEventListener: (_: string, fn: (e: { matches: boolean }) => void) =>
              contrastListeners.push(fn),
            removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
              contrastListeners = contrastListeners.filter((l) => l !== fn);
            },
          };
        }
        return { matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() };
      }),
    });
  });

  it('renders children', () => {
    render(
      <AccessibilityPreferencesProvider>
        <div data-testid="child">Hello</div>
      </AccessibilityPreferencesProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('writes CSS variables to html element', () => {
    render(
      <AccessibilityPreferencesProvider>
        <div />
      </AccessibilityPreferencesProvider>
    );

    const html = document.documentElement;
    expect(html.style.getPropertyValue('--reading-font-scale')).toBe('1');
    expect(html.style.getPropertyValue('--reading-line-height')).toBe('1.5');
    expect(html.style.getPropertyValue('--reading-width')).toBe('68ch');
  });

  it('uses initial preferences', () => {
    render(
      <AccessibilityPreferencesProvider initialPreferences={{ fontScale: '1.3', lineHeight: '2' }}>
        <div />
      </AccessibilityPreferencesProvider>
    );

    const html = document.documentElement;
    expect(html.style.getPropertyValue('--reading-font-scale')).toBe('1.3');
    expect(html.style.getPropertyValue('--reading-line-height')).toBe('2');
  });

  it('sets data-transcript-visible attribute', () => {
    render(
      <AccessibilityPreferencesProvider initialPreferences={{ transcriptAlwaysVisible: true }}>
        <div />
      </AccessibilityPreferencesProvider>
    );

    expect(document.documentElement.dataset.transcriptVisible).toBe('true');
  });
});

describe('useReadingPreferences', () => {
  // Mock matchMedia
  let mockReducedMotion = false;
  let mockHighContrast = false;
  let motionListeners: Array<(e: { matches: boolean }) => void> = [];
  let contrastListeners: Array<(e: { matches: boolean }) => void> = [];

  beforeEach(() => {
    mockReducedMotion = false;
    mockHighContrast = false;
    motionListeners = [];
    contrastListeners = [];

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query: string) => {
        if (query === '(prefers-reduced-motion: reduce)') {
          return {
            matches: mockReducedMotion,
            addEventListener: (_: string, fn: (e: { matches: boolean }) => void) =>
              motionListeners.push(fn),
            removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
              motionListeners = motionListeners.filter((l) => l !== fn);
            },
          };
        }
        if (query === '(prefers-contrast: more)') {
          return {
            matches: mockHighContrast,
            addEventListener: (_: string, fn: (e: { matches: boolean }) => void) =>
              contrastListeners.push(fn),
            removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => {
              contrastListeners = contrastListeners.filter((l) => l !== fn);
            },
          };
        }
        return { matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() };
      }),
    });
  });

  it('throws when used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useReadingPreferences());
    }).toThrow('useReadingPreferences must be used within AccessibilityPreferencesProvider');

    consoleSpy.mockRestore();
  });

  it('returns default preferences', () => {
    const { result } = renderHook(() => useReadingPreferences(), { wrapper });

    expect(result.current.preferences.fontScale).toBe('1');
    expect(result.current.preferences.lineHeight).toBe('1.5');
    expect(result.current.preferences.width).toBe('68ch');
    expect(result.current.preferences.contrast).toBe('normal');
    expect(result.current.preferences.motion).toBe('system');
    expect(result.current.preferences.transcriptAlwaysVisible).toBe(false);
  });

  it('updatePreference updates a single preference', () => {
    const { result } = renderHook(() => useReadingPreferences(), { wrapper });

    act(() => {
      result.current.updatePreference('fontScale', '1.15');
    });

    expect(result.current.preferences.fontScale).toBe('1.15');
    // Others unchanged
    expect(result.current.preferences.lineHeight).toBe('1.5');
  });

  it('motionEffective returns reduced when preference is reduced', () => {
    const customWrapper = ({ children }: { children: ReactNode }) => (
      <AccessibilityPreferencesProvider initialPreferences={{ motion: 'reduced' }}>
        {children}
      </AccessibilityPreferencesProvider>
    );

    const { result } = renderHook(() => useReadingPreferences(), {
      wrapper: customWrapper,
    });

    expect(result.current.motionEffective).toBe('reduced');
  });

  it('motionEffective returns reduced when system prefers reduced motion', () => {
    mockReducedMotion = true;

    const { result } = renderHook(() => useReadingPreferences(), { wrapper });

    expect(result.current.motionEffective).toBe('reduced');
  });

  it('motionEffective returns full when system allows motion', () => {
    mockReducedMotion = false;

    const { result } = renderHook(() => useReadingPreferences(), { wrapper });

    expect(result.current.motionEffective).toBe('full');
  });

  it('contrastEffective returns high when preference is high', () => {
    const customWrapper = ({ children }: { children: ReactNode }) => (
      <AccessibilityPreferencesProvider initialPreferences={{ contrast: 'high' }}>
        {children}
      </AccessibilityPreferencesProvider>
    );

    const { result } = renderHook(() => useReadingPreferences(), {
      wrapper: customWrapper,
    });

    expect(result.current.contrastEffective).toBe('high');
  });

  it('contrastEffective returns high when system prefers high contrast', () => {
    mockHighContrast = true;

    const { result } = renderHook(() => useReadingPreferences(), { wrapper });

    expect(result.current.contrastEffective).toBe('high');
  });
});
