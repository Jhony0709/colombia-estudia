import type { ComponentRef, ReactNode, Ref } from 'react';
import { Pressable, View, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { fill } from './layout';
import { useAsyncPress, usePending } from './pending';
import { Text } from './Text';
import { useTheme } from './theme';

export interface ListItemProps extends Omit<PressableProps, 'children' | 'style' | 'ref' | 'onPress'> {
  /** If it returns a promise, the row waits for it: it fills from where it was pressed. */
  onPress?: (event: GestureResponderEvent) => void | Promise<unknown>;
  title: string;
  description?: string;
  /** Before the text: an icon, an avatar. */
  leading?: ReactNode;
  /** After it: a badge, a figure, a chevron. */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<ComponentRef<typeof Pressable>>;
}

/**
 * A row of a list. With `onPress` it is one button, read whole by a screen reader, that darkens when pressed.
 * At rest it carries no animated component: a list has many rows. Only the one that waits has its fill.
 */
export function ListItem({ title, description, leading, trailing, style, onPress, onPressIn, onLayout, disabled, ...rest }: ListItemProps) {
  const theme = useTheme();
  const [waiting, run, failed] = useAsyncPress(onPress);
  const pending = usePending(waiting, theme.color['text.default'], failed);
  const row: ViewStyle = { minHeight: theme.size['target.min'], flexDirection: 'row', alignItems: 'center', gap: theme.size['space.3'], paddingInline: theme.size['space.4'], paddingBlock: theme.size['space.2'] };
  const body = (
    <>
      {leading}
      <View style={fill}>
        <Text variant="label">{title}</Text>
        {description !== undefined && (
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        )}
      </View>
      {trailing}
    </>
  );
  if (!onPress) {
    return (
      <View testID={rest.testID} style={[row, style]}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      role="button"
      aria-disabled={!!disabled}
      aria-busy={waiting}
      {...rest}
      onPress={run}
      onPressIn={(e) => {
        pending.onPressIn(e);
        onPressIn?.(e);
      }}
      onLayout={(e) => {
        pending.onLayout(e);
        onLayout?.(e);
      }}
      disabled={!!disabled || waiting}
      style={({ pressed }) => [row, { overflow: 'hidden' }, pressed ? { backgroundColor: theme.color['surface.hover'] } : null, disabled ? { opacity: 0.5 } : null, style]}
    >
      {pending.fill}
      {body}
    </Pressable>
  );
}
