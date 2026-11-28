import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, View } from 'react-native';
import { toneColors } from './Badge';
import { Appear } from './presence';
import { Text } from './Text';
import { useTheme } from './theme';

export interface ToastInput {
  title: string;
  description?: string;
  /** Default: 'info'. */
  tone?: 'info' | 'success' | 'warning' | 'danger';
  /** How long it stays, in ms; 0 stays until it is pressed. Default: 5000, and 0 for a danger. */
  duration?: number;
}

const Context = createContext<((toast: ToastInput) => void) | null>(null);
/** The notices themselves: the provider paints them, and so does every window open above it. */
const Layer = createContext<ReactNode>(null);

/** Inside a window that opens above the app (`Modal`), where the notices of the app would be behind. */
export const ToastLayer = (): ReactNode => useContext(Layer);

export interface ToastProviderProps {
  children?: ReactNode;
  /** How far from the bottom: the app's safe area, or what a tab bar takes. Default: `space.4`. */
  inset?: number;
  /** What pressing one does, for a screen reader. Default: 'Dismiss'. */
  dismissLabel?: string;
}

/** Said aloud on both platforms: Android reads a live region by itself, iOS has to be told. */
export const announce = (text: string): void => {
  if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(text);
};

/** Holds the notices of the app above everything it wraps: put it once, near the root. */
export function ToastProvider({ children, inset, dismissLabel = 'Dismiss' }: ToastProviderProps) {
  const theme = useTheme();
  const [toasts, setToasts] = useState<readonly (ToastInput & { id: number })[]>([]);
  const next = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (input: ToastInput) => {
      const id = ++next.current;
      setToasts((list) => [...list, { ...input, id }]);
      announce(input.description ? `${input.title}. ${input.description}` : input.title);
      const ms = input.duration ?? (input.tone === 'danger' ? 0 : 5000);
      if (ms) timers.current.add(setTimeout(() => dismiss(id), ms));
    },
    [dismiss],
  );
  const edge = theme.size['space.4'];
  const layer = (
    <View pointerEvents="box-none" style={{ position: 'absolute', start: edge, end: edge, bottom: inset ?? edge, gap: theme.size['space.2'] }}>
      {toasts.map((t) => (
        <Appear key={t.id}>
          <Pressable
            role="alert"
            aria-live={t.tone === 'danger' ? 'assertive' : 'polite'}
            accessibilityHint={dismissLabel}
            onPress={() => dismiss(t.id)}
            style={{ minHeight: theme.size['target.min'], flexDirection: 'row', alignItems: 'center', gap: theme.size['space.3'], padding: theme.size['space.3'], borderWidth: 1, borderColor: theme.color['border.default'], borderRadius: theme.size['radius.card'], backgroundColor: theme.color['surface.raised'] }}
          >
            <View style={{ width: theme.size['space.2'], height: theme.size['space.2'], borderRadius: theme.size['space.2'], backgroundColor: toneColors(theme, t.tone ?? 'info').solid }} />
            <View style={{ flex: 1 }}>
              <Text variant="label">{t.title}</Text>
              {t.description !== undefined && (
                <Text variant="caption" tone="muted">
                  {t.description}
                </Text>
              )}
            </View>
          </Pressable>
        </Appear>
      ))}
    </View>
  );
  return (
    <Context.Provider value={toast}>
      <Layer.Provider value={layer}>{children}</Layer.Provider>
      {layer}
    </Context.Provider>
  );
}

/** `toast({ title })` shows a notice. */
export function useToast(): (toast: ToastInput) => void {
  const toast = useContext(Context);
  if (!toast) throw new Error('@fluxus-ui/native: no toasts. Wrap the app in <ToastProvider>, inside <ThemeProvider>.');
  return toast;
}
