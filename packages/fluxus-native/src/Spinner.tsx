import { ActivityIndicator, type ActivityIndicatorProps } from 'react-native';
import { useTheme } from './theme';

export interface SpinnerProps extends Omit<ActivityIndicatorProps, 'size' | 'color'> {
  /** What is loading, for a screen reader. Without it the spinner is decoration and is hidden from one. */
  label?: string;
  /** Default: 'md'. The system draws two sizes: 'lg' is the large one. */
  size?: 'sm' | 'md' | 'lg';
  /** Default: 'muted'. */
  tone?: 'muted' | 'accent';
}

/** Something is loading. Where there is a layout to show, a Skeleton instead. */
export function Spinner({ label, size = 'md', tone = 'muted', ...rest }: SpinnerProps) {
  const theme = useTheme();
  const a11y = label ? ({ accessible: true, role: 'status', 'aria-label': label, 'aria-busy': true } as const) : ({ 'aria-hidden': true, importantForAccessibility: 'no-hide-descendants' } as const);
  return <ActivityIndicator {...a11y} {...rest} size={size === 'lg' ? 'large' : 'small'} color={theme.color[tone === 'accent' ? 'accent.default' : 'text.muted']} />;
}
