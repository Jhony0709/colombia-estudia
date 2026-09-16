/** @jest-environment jsdom */
/**
 * Tests for lib/a11y/announce.tsx
 */

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { AnnounceProvider, useAnnounce } from '@/lib/a11y/announce';

// Test component that uses the hook
function TestConsumer() {
  const { announce } = useAnnounce();

  return (
    <div>
      <button onClick={() => announce('polite message')}>Polite</button>
      <button onClick={() => announce('assertive message', { assertive: true })}>Assertive</button>
    </div>
  );
}

describe('AnnounceProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders children', () => {
    render(
      <AnnounceProvider>
        <div data-testid="child">Hello</div>
      </AnnounceProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders polite live region', () => {
    render(
      <AnnounceProvider>
        <div />
      </AnnounceProvider>
    );

    const polite = screen.getByRole('status');
    expect(polite).toHaveAttribute('aria-live', 'polite');
    expect(polite).toHaveAttribute('aria-atomic', 'true');
    expect(polite).toHaveClass('sr-only');
  });

  it('renders assertive live region', () => {
    render(
      <AnnounceProvider>
        <div />
      </AnnounceProvider>
    );

    const assertive = screen.getByRole('alert');
    expect(assertive).toHaveAttribute('aria-live', 'assertive');
    expect(assertive).toHaveAttribute('aria-atomic', 'true');
    expect(assertive).toHaveClass('sr-only');
  });
});

describe('useAnnounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('throws when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useAnnounce must be used within AnnounceProvider');

    consoleSpy.mockRestore();
  });

  it('announce() writes to polite region', async () => {
    render(
      <AnnounceProvider>
        <TestConsumer />
      </AnnounceProvider>
    );

    const button = screen.getByText('Polite');
    act(() => {
      button.click();
    });

    // Wait for requestAnimationFrame
    act(() => {
      jest.runAllTimers();
    });

    const polite = screen.getByRole('status');
    expect(polite).toHaveTextContent('polite message');
  });

  it('announce() with assertive writes to assertive region', async () => {
    render(
      <AnnounceProvider>
        <TestConsumer />
      </AnnounceProvider>
    );

    const button = screen.getByText('Assertive');
    act(() => {
      button.click();
    });

    act(() => {
      jest.runAllTimers();
    });

    const assertive = screen.getByRole('alert');
    expect(assertive).toHaveTextContent('assertive message');
  });

  it('clears and sets to announce repeated messages', async () => {
    render(
      <AnnounceProvider>
        <TestConsumer />
      </AnnounceProvider>
    );

    const button = screen.getByText('Polite');
    const polite = screen.getByRole('status');

    // First announcement
    act(() => {
      button.click();
    });
    act(() => {
      jest.runAllTimers();
    });
    expect(polite).toHaveTextContent('polite message');

    // Second identical announcement should still work
    // (clear + set pattern)
    act(() => {
      button.click();
    });

    // After click, content should be cleared
    expect(polite).toHaveTextContent('');

    act(() => {
      jest.runAllTimers();
    });
    expect(polite).toHaveTextContent('polite message');
  });
});
