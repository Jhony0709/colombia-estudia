/** @jest-environment jsdom */
/**
 * Tests for lib/a11y/focus-manager.tsx
 *
 * CORRECTION 13: Mock next/navigation
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { FocusManager, useReturnFocus } from '@/lib/a11y/focus-manager';
import { renderHook } from '@testing-library/react';

// Mock next/navigation
let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('FocusManager', () => {
  beforeEach(() => {
    mockPathname = '/';
    document.body.innerHTML = '';
  });

  it('renders nothing', () => {
    const { container } = render(<FocusManager />);
    expect(container).toBeEmptyDOMElement();
  });

  it('focuses h1 on pathname change', () => {
    // Set up DOM with h1
    document.body.innerHTML = '<h1>Page Title</h1>';
    const h1 = document.querySelector('h1')!;
    const focusSpy = jest.spyOn(h1, 'focus');

    // Initial render
    const { rerender } = render(<FocusManager />);

    // No focus on initial render (pathname hasn't changed)
    expect(focusSpy).not.toHaveBeenCalled();

    // Simulate navigation
    mockPathname = '/new-page';
    rerender(<FocusManager />);

    expect(h1).toHaveAttribute('tabindex', '-1');
    expect(focusSpy).toHaveBeenCalled();
  });

  it('does not focus if pathname is the same', () => {
    document.body.innerHTML = '<h1>Page Title</h1>';
    const h1 = document.querySelector('h1')!;
    const focusSpy = jest.spyOn(h1, 'focus');

    const { rerender } = render(<FocusManager />);
    rerender(<FocusManager />);

    expect(focusSpy).not.toHaveBeenCalled();
  });
});

describe('useReturnFocus', () => {
  it('saves and returns focus to trigger element', () => {
    const { result } = renderHook(() => useReturnFocus());

    // Create a trigger element
    const trigger = document.createElement('button');
    trigger.textContent = 'Open';
    document.body.appendChild(trigger);
    trigger.focus();

    // Save trigger
    act(() => {
      result.current.saveTrigger();
    });

    // Focus something else
    const other = document.createElement('button');
    other.textContent = 'Other';
    document.body.appendChild(other);
    other.focus();

    expect(document.activeElement).toBe(other);

    // Return focus
    act(() => {
      result.current.returnFocus();
    });

    expect(document.activeElement).toBe(trigger);

    // Cleanup
    document.body.innerHTML = '';
  });
});
