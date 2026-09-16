/**
 * Alert atom.
 * SSOT: reference/03-ui/accesibilidad.md
 *
 * Accessible alert component with severity-based styling and icons.
 * Uses role="alert" for errors (urgent), role="status" for others (polite).
 */

import type { ReactNode } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AlertSeverity = 'success' | 'warning' | 'error' | 'info';

const severityConfig: Record<
  AlertSeverity,
  { role: 'alert' | 'status'; bg: string; Icon: typeof Info }
> = {
  success: {
    role: 'status',
    bg: 'bg-status-success-muted',
    Icon: CheckCircle,
  },
  warning: {
    role: 'status',
    bg: 'bg-status-warning-muted',
    Icon: AlertTriangle,
  },
  error: {
    role: 'alert',
    bg: 'bg-status-error-muted',
    Icon: XCircle,
  },
  info: {
    role: 'status',
    bg: 'bg-status-info-muted',
    Icon: Info,
  },
};

export interface AlertProps {
  /** Alert severity determines styling and ARIA role */
  severity: AlertSeverity;
  /** Alert content */
  children: ReactNode;
  /** Additional className */
  className?: string;
}

/**
 * Alert component for status messages.
 *
 * Features:
 * - Four severity levels: success, warning, error, info
 * - Error uses role="alert" (assertive), others use role="status" (polite)
 * - Icon + text for redundant visual indication (not color alone)
 * - Respects design tokens for colors
 */
export function Alert({ severity, children, className }: AlertProps) {
  const config = severityConfig[severity];
  const Icon = config.Icon;

  return (
    <div
      role={config.role}
      className={cn('rounded-card flex gap-3 p-4', config.bg, 'text-text', className)}
    >
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <div className="type-body">{children}</div>
    </div>
  );
}
