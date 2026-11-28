import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { ActivityIndicator, Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useAsyncPress, usePending } from './pending';
import { presence } from './presence';
import { usePress } from './press';
import { Text } from './Text';
import { useTheme, type Theme } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style' | 'ref' | 'onPress'> {
  /** If it returns a promise, the button waits for it: it fills from where it was pressed and takes no other press. */
  onPress?: (event: GestureResponderEvent) => void | Promise<unknown>;
  children: ReactNode;
  /** Default: 'secondary'. */
  variant?: ButtonVariant;
  /** Default: 'md'. */
  size?: ButtonSize;
  /** It is working: it shows a spinner, says so to a screen reader and takes no press. */
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<ComponentRef<typeof Pressable>>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The surface, the ink and the edge of a variant, and the box of a size: only tokens. */
export function buttonStyle(theme: Theme, variant: ButtonVariant = 'secondary', size: ButtonSize = 'md'): { box: ViewStyle; ink: string; slop: number } {
  const c = theme.color;
  const [surface, ink, edge] = {
    primary: [c['button.bg'], c['button.fg'], 'transparent'],
    secondary: [c['surface.raised'], c['text.default'], c['border.control']],
    ghost: ['transparent', c['text.default'], 'transparent'],
    danger: [c['state.danger.subtle'], c['state.danger.text'], 'transparent'],
  }[variant] as [string, string, string];
  const height = theme.size[`control.h.${size}`];
  return {
    box: {
      // A minimum, not a height: the text grows with the system's text size.
      minHeight: height,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.size['space.2'],
      paddingHorizontal: theme.size['pad.control-x'],
      borderWidth: 1,
      borderColor: edge,
      borderRadius: theme.size['button.radius'],
      backgroundColor: surface,
    },
    ink,
    // A small button is still a target of target.min: the rest is around it.
    slop: Math.max(0, (theme.size['target.min'] - height) / 2),
  };
}

/** A button with the variants and sizes of the web; pressed, it gives on the snappy spring. */
export function Button({ children, variant = 'secondary', size = 'md', busy = false, disabled, style, onPress, onPressIn, onPressOut, onLayout, onFocus, onBlur, ...rest }: ButtonProps) {
  const theme = useTheme();
  const { box, ink, slop } = buttonStyle(theme, variant, size);
  const [waiting, run, failed] = useAsyncPress(onPress);
  const pending = usePending(waiting, ink, failed);
  const off = !!disabled || busy || waiting;
  const press = usePress({ onPressIn, onPressOut });
  const { layout, ...coming } = presence();
  // With a keyboard or a remote: a ring around it, drawn outside so that nothing moves.
  const [focused, setFocused] = useState(false);
  const ring: ViewStyle | null = focused ? { outlineStyle: 'solid', outlineWidth: theme.size['focus.width'], outlineOffset: theme.size['focus.offset'], outlineColor: theme.color['focus.ring'] } : null;
  return (
    <AnimatedPressable
      role="button"
      hitSlop={slop}
      {...rest}
      disabled={off}
      aria-disabled={off}
      aria-busy={busy || waiting}
      onPress={run}
      onLayout={(e) => {
        pending.onLayout(e);
        onLayout?.(e);
      }}
      onPressIn={(e) => {
        pending.onPressIn(e);
        press.onPressIn(e);
      }}
      onPressOut={press.onPressOut}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[box, { overflow: 'hidden' }, disabled ? { opacity: 0.5 } : null, ring, style, press.style]}
    >
      {pending.fill}
      {busy && (
        <Animated.View {...coming}>
          <ActivityIndicator size="small" color={ink} />
        </Animated.View>
      )}
      {/* The label makes room for the spinner by gliding, not by jumping. */}
      <Animated.View layout={layout}>
        {typeof children === 'string' ? (
          <Text variant="label" style={{ color: ink }}>
            {children}
          </Text>
        ) : (
          children
        )}
      </Animated.View>
    </AnimatedPressable>
  );
}
