import { useEffect, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Pressable, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { timing } from './motion';
import { presence } from './presence';
import { Text, textStyle } from './Text';
import { useTheme } from './theme';
import { announce } from './Toast';

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'ref'> {
  label: string;
  /** Help under the field. */
  hint?: string;
  /** What is wrong, and how to fix it. It takes the place of the hint. */
  error?: string;
  /** The label is only for a screen reader: a search field, whose place says what it is. */
  labelHidden?: boolean;
  /** Several lines: the field is this many lines tall at least, and grows with what is written. */
  rows?: number;
  /** At the end of the field, inside it: a button to clear it. */
  trailing?: ReactNode;
  /** A password: what is written is hidden, and a button in the field shows it. The two names of that button. */
  reveal?: { show: string; hide: string };
  /** The style of the whole field: its label, its box and its message. */
  style?: StyleProp<ViewStyle>;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/** A text input with its label, its help and its error. A screen reader hears the three with the field. */
export function TextField({ label, hint, error, labelHidden, rows, trailing, reveal, style, editable = true, onFocus, onBlur, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const c = theme.color;
  const focus = useSharedValue(0);
  const [hidden, setHidden] = useState(true);
  const rest0 = error ? c['state.danger.solid'] : c['input.border'];
  const edge = useAnimatedStyle(() => ({ borderColor: interpolateColor(focus.value, [0, 1], [rest0, c['accent.default']]) }));
  // The ring of the focus: a second line around the edge, always there, so that nothing moves when it shows.
  const lit = c['focus.ring'];
  const ring = useAnimatedStyle(() => ({ borderColor: interpolateColor(focus.value, [0, 1], [`${lit.slice(0, 7)}00`, lit]) }));
  const radius = theme.size['radius.control'];
  const message = error ?? hint;
  // Android reads a live region when it appears; iOS has to be told.
  useEffect(() => {
    if (error) announce(error);
  }, [error]);
  const { layout: _layout, ...coming } = presence();
  return (
    <View style={[{ gap: theme.size['space.1'], opacity: editable ? 1 : 0.5 }, style]}>
      {!labelHidden && <Text variant="label">{label}</Text>}
      <Animated.View style={[{ borderWidth: 1, borderRadius: radius + 1 }, ring]}>
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius, backgroundColor: c['input.bg'] }, edge]}>
        <TextInput
          aria-label={label}
          accessibilityHint={message}
          placeholderTextColor={c['text.muted']}
          {...rest}
          {...(reveal ? { secureTextEntry: hidden } : null)}
          {...(rows ? { multiline: true, textAlignVertical: 'top' as const } : null)}
          editable={editable}
          onFocus={(e) => {
            focus.value = timing(1, 'fast');
            onFocus?.(e);
          }}
          onBlur={(e) => {
            focus.value = timing(0, 'fast');
            onBlur?.(e);
          }}
          // A field is touched: at least target.min tall, and it grows with the system's text size.
          style={[textStyle(theme), { flex: 1, minHeight: rows ? rows * (textStyle(theme).lineHeight ?? 0) + 2 * theme.size['space.2'] : theme.size['target.min'], paddingHorizontal: theme.size['pad.control-x'], paddingVertical: theme.size['space.2'] }]}
        />
          {trailing}
          {reveal && (
            <Pressable role="button" onPress={() => setHidden((h) => !h)} style={{ minWidth: theme.size['target.min'], minHeight: theme.size['target.min'], alignItems: 'center', justifyContent: 'center', paddingInline: theme.size['space.2'] }}>
              <Text variant="label" tone="accent">
                {hidden ? reveal.show : reveal.hide}
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </Animated.View>
      {message !== undefined && (
        // The key: an error takes the place of the help by coming in, not by changing its letters.
        <Animated.View key={error ? 'error' : 'hint'} {...coming}>
          <Text variant="caption" tone={error ? 'default' : 'muted'} style={error ? { color: c['state.danger.text'] } : undefined} accessibilityLiveRegion={error ? 'polite' : 'none'}>
            {message}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

/** A text input of several lines: three at least, unless `rows` says otherwise. */
export function TextArea({ rows = 3, ...rest }: Omit<TextFieldProps, 'reveal' | 'trailing'>) {
  return <TextField rows={rows} {...rest} />;
}

export interface SearchFieldProps extends Omit<TextFieldProps, 'reveal' | 'rows' | 'trailing' | 'labelHidden' | 'onSubmitEditing'> {
  /** With the key «search» of the keyboard. */
  onSearch?: (text: string) => void;
  /** The name of the button that empties it. Default: 'Clear'. */
  clearLabel?: string;
}

/** A field to search with: its label is only for a screen reader, and a button empties it once it has text. */
export function SearchField({ value, defaultValue = '', onChangeText, onSearch, clearLabel = 'Clear', ...rest }: SearchFieldProps) {
  const theme = useTheme();
  const [own, setOwn] = useState(defaultValue);
  const text = value ?? own;
  const change = (next: string): void => {
    if (value === undefined) setOwn(next);
    onChangeText?.(next);
  };
  return (
    <TextField
      role="searchbox"
      returnKeyType="search"
      autoCapitalize="none"
      autoCorrect={false}
      {...rest}
      labelHidden
      value={text}
      onChangeText={change}
      onSubmitEditing={() => onSearch?.(text)}
      trailing={
        text ? (
          <Pressable role="button" aria-label={clearLabel} onPress={() => change('')} style={{ minWidth: theme.size['target.min'], minHeight: theme.size['target.min'], alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="title" tone="muted" aria-hidden>
              ×
            </Text>
          </Pressable>
        ) : null
      }
    />
  );
}

