import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

export interface EmptyStateProps extends ViewProps {
  title: string;
  /** What to do about it. */
  children?: ReactNode;
  /** A button under the text. */
  action?: ReactNode;
}

/** There is nothing here, and what to do about it. */
export function EmptyState({ title, children, action, style, ...rest }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View {...rest} style={[{ alignItems: 'center', gap: theme.size['space.2'], padding: theme.size['space.6'] }, style]}>
      <Text variant="title" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {typeof children === 'string' ? (
        <Text tone="muted" style={{ textAlign: 'center' }}>
          {children}
        </Text>
      ) : (
        children
      )}
      {action !== undefined && <View style={{ marginBlockStart: theme.size['space.2'] }}>{action}</View>}
    </View>
  );
}
