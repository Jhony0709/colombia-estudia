/**
 * One of a few, chosen in a sheet. The field looks as a TextField does; the options are radios, which is what
 * they are. If the app takes its time with the choice, the row waits and the sheet closes after. (SPEC §15.8)
 */
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Chevron } from './Disclosure';
import { fill } from './layout';
import { ListItem } from './ListItem';
import { focusOn } from './overlay';
import { settle } from './pending';
import { Text } from './Text';
import { useTheme } from './theme';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string> {
  label: string;
  options: readonly SelectOption<T>[];
  value?: T | null;
  /** It holds its own value from here. */
  defaultValue?: T | null;
  /** If it returns a promise, the chosen row waits for it and the sheet closes once it is fulfilled. */
  onChange?: (value: T) => void | Promise<unknown>;
  /** What the field says with nothing chosen. */
  placeholder?: string;
  /** Help under the field. */
  hint?: string;
  /** What is wrong, and how to fix it. It takes the place of the hint. */
  error?: string;
  disabled?: boolean;
  /** For the sheet: what the bottom edge of the screen takes, and the name of its handle. */
  inset?: number;
  closeLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Select<T extends string = string>({ label, options, value, defaultValue = null, onChange, placeholder, hint, error, disabled = false, inset, closeLabel, style, testID }: SelectProps<T>) {
  const theme = useTheme();
  const c = theme.color;
  const [own, setOwn] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const field = useRef<ComponentRef<typeof Pressable>>(null);
  const now = value === undefined ? own : value;
  const chosen = options.find((o) => o.value === now);
  const message = error ?? hint;
  const close = (): void => {
    setOpen(false);
    focusOn(field.current);
  };
  const choose = (next: T): void | Promise<void> => {
    if (value === undefined) setOwn(next);
    return settle(onChange?.(next), close);
  };
  const radius = theme.size['radius.control'];
  return (
    <View style={[{ gap: theme.size['space.1'], opacity: disabled ? 0.5 : 1 }, style]}>
      <Text variant="label" aria-hidden>
        {label}
      </Text>
      {/* The ring of the focus: a second line around the edge, always there, so that nothing moves when it shows. */}
      <View style={{ borderWidth: 1, borderRadius: radius + 1, borderColor: focused ? c['focus.ring'] : 'transparent' }}>
        <Pressable
          ref={field}
          role="combobox"
          aria-expanded={open}
          aria-disabled={disabled}
          aria-label={[label, chosen?.label ?? placeholder].filter(Boolean).join(', ')}
          accessibilityHint={message}
          testID={testID}
          disabled={disabled}
          onPress={() => setOpen(true)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ minHeight: theme.size['target.min'], flexDirection: 'row', alignItems: 'center', gap: theme.size['space.2'], paddingInline: theme.size['pad.control-x'], borderWidth: 1, borderRadius: radius, borderColor: error ? c['state.danger.solid'] : focused ? c['accent.default'] : c['input.border'], backgroundColor: c['input.bg'] }}
        >
          <Text tone={chosen ? 'default' : 'muted'} numberOfLines={1} style={fill}>
            {chosen?.label ?? placeholder}
          </Text>
          <Chevron />
        </Pressable>
      </View>
      {message !== undefined && (
        <Text variant="caption" tone={error ? 'default' : 'muted'} style={error ? { color: c['state.danger.text'] } : undefined}>
          {message}
        </Text>
      )}
      <BottomSheet open={open} onClose={close} title={label} inset={inset} closeLabel={closeLabel}>
        <View role="radiogroup" aria-label={label} style={{ marginInline: -theme.size['space.4'] }}>
          {options.map((option) => {
            const on = option.value === now;
            return (
              <ListItem
                key={option.value}
                role="radio"
                aria-checked={on}
                title={option.label}
                description={option.description}
                disabled={option.disabled}
                onPress={() => choose(option.value)}
                // The mark of the chosen one: the two sides of a rectangle, turned.
                trailing={on ? <View aria-hidden style={{ width: theme.size['space.2'], height: theme.size['space.3'] + 2, marginInlineEnd: theme.size['space.1'], borderColor: c['accent.default'], borderEndWidth: 2, borderBottomWidth: 2, transform: [{ rotate: '45deg' }] }} /> : null}
              />
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}
