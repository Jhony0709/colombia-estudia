import { useEffect, type ReactNode } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { toneColors } from './Badge';
import { announce } from './Toast';
import { Text } from './Text';
import { useTheme } from './theme';

export interface MessageProps extends Omit<ViewProps, 'style'> {
  children: ReactNode;
  /** Default: 'info'. */
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  /** It is announced when it appears: at once if it is a danger, when the reader is free otherwise. Default: true. */
  live?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Something the person has to know: a notice, or what went wrong and what to do. */
export function Message({ children, tone = 'info', title, live = true, style, ...rest }: MessageProps) {
  const theme = useTheme();
  const { subtle, ink } = toneColors(theme, tone);
  const urgent = tone === 'danger';
  // Android reads a live region when it appears; iOS has to be told.
  const said = [title, typeof children === 'string' ? children : undefined].filter(Boolean).join('. ');
  useEffect(() => {
    if (live && said) announce(said);
  }, [live, said]);
  return (
    <View
      role={live && urgent ? 'alert' : undefined}
      aria-live={live ? (urgent ? 'assertive' : 'polite') : 'off'}
      {...rest}
      style={[{ gap: theme.size['space.1'], padding: theme.size['space.3'], borderRadius: theme.size['radius.control'], backgroundColor: subtle }, style]}
    >
      {title !== undefined && (
        <Text variant="label" style={{ color: ink }}>
          {title}
        </Text>
      )}
      {typeof children === 'string' ? <Text>{children}</Text> : children}
    </View>
  );
}
