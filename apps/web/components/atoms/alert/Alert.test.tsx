/** @jest-environment jsdom */
/**
 * Tests for Alert atom.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Alert, type AlertSeverity } from './Alert';

describe('Alert', () => {
  it('renders children text', () => {
    render(<Alert severity="info">Mensaje informativo</Alert>);
    expect(screen.getByText('Mensaje informativo')).toBeInTheDocument();
  });

  it('renders icon', () => {
    const { container } = render(<Alert severity="info">Info</Alert>);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  describe('role based on severity', () => {
    it('error uses role="alert"', () => {
      render(<Alert severity="error">Error message</Alert>);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('success uses role="status"', () => {
      render(<Alert severity="success">Success message</Alert>);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('warning uses role="status"', () => {
      render(<Alert severity="warning">Warning message</Alert>);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('info uses role="status"', () => {
      render(<Alert severity="info">Info message</Alert>);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('styling by severity', () => {
    const severities: AlertSeverity[] = ['success', 'warning', 'error', 'info'];

    severities.forEach((severity) => {
      it(`${severity} has bg-status-${severity}-muted class`, () => {
        const { container } = render(<Alert severity={severity}>{severity} message</Alert>);
        const alert = container.firstChild as HTMLElement;
        expect(alert).toHaveClass(`bg-status-${severity}-muted`);
      });
    });
  });

  it('applies custom className', () => {
    const { container } = render(
      <Alert severity="info" className="custom-class">
        Info
      </Alert>
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('has type-body class for text content', () => {
    render(<Alert severity="info">Info message</Alert>);
    // getByText returns the element containing the text, which has type-body
    expect(screen.getByText('Info message')).toHaveClass('type-body');
  });

  it('icon is decorative (aria-hidden)', () => {
    const { container } = render(<Alert severity="success">Success</Alert>);
    const icon = container.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
