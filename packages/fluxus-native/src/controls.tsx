/**
 * What is switched: a checkbox, a switch and a group of radios. Each is one row to press, of 44 points at least,
 * with its label and its help; the mark moves by its transform and the colours fade. (SPEC §15.7)
 */
import { useEffect, useState, type ReactNode } from 'react';
import { I18nManager, Pressable, View, type PressableProps, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { fill } from './layout';
import { spring, timing } from './motion';
import { Text } from './Text';
import { useTheme } from './theme';

/** A value the app holds, or one the piece holds by itself from `defaultValue`. */
export function useControlled<T>(value: T | undefined, initial: T, onChange?: (next: T) => void): [T, (next: T) => void] {
  const [own, setOwn] = useState(initial);
  return [
    value === undefined ? own : value,
    (next) => {
      if (value === undefined) setOwn(next);
      onChange?.(next);
    },
  ];
}

interface RowProps extends Omit<PressableProps, 'children' | 'style' | 'role'> {
  role: 'checkbox' | 'switch' | 'radio';
  checked: boolean | 'mixed';
  label: string;
  hint?: string;
  /** The box, the track or the ring. */
  control: ReactNode;
  /** A switch goes after its text; the others before. */
  after?: boolean;
  style?: StyleProp<ViewStyle>;
}

function Row({ role, checked, label, hint, control, after, disabled, style, ...rest }: RowProps) {
  const theme = useTheme();
  return (
    <Pressable
      role={role}
      aria-checked={checked}
      aria-disabled={!!disabled}
      aria-label={hint ? `${label}. ${hint}` : label}
      {...rest}
      disabled={disabled}
      style={[{ minHeight: theme.size['target.min'], flexDirection: after ? 'row-reverse' : 'row', alignItems: 'center', gap: theme.size['space.3'], paddingBlock: theme.size['space.2'], opacity: disabled ? 0.5 : 1 }, style]}
    >
      {control}
      <View style={fill}>
        <Text>{label}</Text>
        {hint !== undefined && (
          <Text variant="caption" tone="muted">
            {hint}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/** 0 → 1 as it goes on: `to` for what moves, on the snappy spring; `tint` for the colours, on the fast curve. */
function useOn(on: boolean) {
  const to = useSharedValue(on ? 1 : 0);
  const tint = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    to.value = spring(on ? 1 : 0, 'snappy');
    tint.value = timing(on ? 1 : 0, 'fast');
  }, [on, to, tint]);
  return { to, tint };
}

interface ToggleProps extends Omit<PressableProps, 'children' | 'style' | 'onPress' | 'role'> {
  label: string;
  hint?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  style?: StyleProp<ViewStyle>;
}

export interface CheckboxProps extends ToggleProps {
  /** Neither on nor off: some of what it stands for is chosen. */
  mixed?: boolean;
}

export function Checkbox({ checked, defaultChecked = false, mixed = false, onChange, ...rest }: CheckboxProps) {
  const theme = useTheme();
  const c = theme.color;
  const [on, set] = useControlled(checked, defaultChecked, onChange);
  const { to, tint } = useOn(on || mixed);
  const side = theme.size['icon.md'];
  const box = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(tint.value, [0, 1], [c['input.bg'], c['accent.default']]),
    borderColor: interpolateColor(tint.value, [0, 1], [c['border.control'], c['accent.default']]),
  }));
  const mark = useAnimatedStyle(() => ({ opacity: tint.value, transform: [{ scale: to.value }, { rotate: mixed ? '0deg' : '45deg' }] }));
  const ink = c['text.on-accent'];
  return (
    <Row
      role="checkbox"
      checked={mixed ? 'mixed' : on}
      {...rest}
      onPress={() => set(mixed ? true : !on)}
      control={
        <Animated.View style={[{ width: side, height: side, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: theme.size['radius.1'] }, box]}>
          {/* The tick is two sides of a rectangle, turned; a dash when it is mixed. */}
          <Animated.View style={[mixed ? { width: side / 2, height: 2, backgroundColor: ink } : { width: side * 0.3, height: side * 0.55, marginBlockEnd: side * 0.1, borderColor: ink, borderEndWidth: 2, borderBottomWidth: 2 }, mark]} />
        </Animated.View>
      }
    />
  );
}

export type SwitchProps = ToggleProps;

export function Switch({ checked, defaultChecked = false, onChange, ...rest }: SwitchProps) {
  const theme = useTheme();
  const c = theme.color;
  const [on, set] = useControlled(checked, defaultChecked, onChange);
  const { to, tint } = useOn(on);
  const height = theme.size['control.h.sm'];
  const pad = theme.size['space.1'] / 2;
  const thumb = height - 2 * pad;
  const travel = height * 0.75;
  const way = I18nManager.isRTL ? -1 : 1;
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(tint.value, [0, 1], [c['border.control'], c['accent.default']]) }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: way * to.value * travel }] }));
  return (
    <Row
      role="switch"
      after
      checked={on}
      {...rest}
      onPress={() => set(!on)}
      control={
        <Animated.View style={[{ width: height + travel, height, padding: pad, borderRadius: height }, track]}>
          <Animated.View style={[{ width: thumb, height: thumb, borderRadius: thumb, backgroundColor: c['surface.base'] }, knob]} />
        </Animated.View>
      }
    />
  );
}

export interface RadioOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export interface RadioGroupProps extends Omit<ViewProps, 'children'> {
  /** The name of the group, for a screen reader. */
  label: string;
  options: readonly RadioOption[];
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

function Radio({ option, on, disabled, onPress }: { option: RadioOption; on: boolean; disabled: boolean; onPress: () => void }) {
  const theme = useTheme();
  const c = theme.color;
  const { to, tint } = useOn(on);
  const side = theme.size['icon.md'];
  const ring = useAnimatedStyle(() => ({ borderColor: interpolateColor(tint.value, [0, 1], [c['border.control'], c['accent.default']]) }));
  const dot = useAnimatedStyle(() => ({ transform: [{ scale: to.value }] }));
  return (
    <Row
      role="radio"
      checked={on}
      label={option.label}
      hint={option.hint}
      disabled={disabled}
      onPress={onPress}
      control={
        <Animated.View style={[{ width: side, height: side, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: side, backgroundColor: c['input.bg'] }, ring]}>
          <Animated.View style={[{ width: side / 2, height: side / 2, borderRadius: side, backgroundColor: c['accent.default'] }, dot]} />
        </Animated.View>
      }
    />
  );
}

/** One of a few, all in sight. */
export function RadioGroup({ label, options, value, defaultValue = null, onChange, disabled = false, ...rest }: RadioGroupProps) {
  const [chosen, set] = useControlled<string | null>(value, defaultValue, onChange as (next: string | null) => void);
  return (
    <View role="radiogroup" aria-label={label} {...rest}>
      {options.map((option) => (
        <Radio key={option.value} option={option} on={option.value === chosen} disabled={disabled || !!option.disabled} onPress={() => set(option.value)} />
      ))}
    </View>
  );
}
