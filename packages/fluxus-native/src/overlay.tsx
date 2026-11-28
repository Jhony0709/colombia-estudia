/**
 * What opens above everything: a window of React Native (`Modal`) that paints and moves nothing of its own,
 * where Fluxus draws the veil and moves the panel. Back on Android, Escape in a browser and the scrub of
 * VoiceOver close it. (SPEC §15.8)
 */
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, StyleSheet, View, type HostInstance, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { motion } from './generated/tokens';
import { spring, timing } from './motion';
import { useTheme, type Theme } from './theme';
import { ToastLayer } from './Toast';

/** A screen reader goes to it: to the title on opening, back to what opened it on closing. */
export const focusOn = (target: unknown): void => {
  if (target && Platform.OS !== 'web') AccessibilityInfo.sendAccessibilityEvent(target as HostInstance, 'focus');
};

/** The surface of what floats: raised, edged, and with the one shadow of the package. */
export const floating = (theme: Theme): ViewStyle => ({
  borderWidth: 1,
  borderColor: theme.color['border.default'],
  borderRadius: theme.size['radius.card'],
  backgroundColor: theme.color['surface.raised'],
  boxShadow: [{ offsetX: 0, offsetY: theme.size['space.2'], blurRadius: theme.size['space.6'], color: theme.color['shadow.tint'] }],
});

/** `mounted` outlives `open` by the time it takes to go; `t` goes 0 → 1 as it comes and back as it goes. */
export function useOverlay(open: boolean): { mounted: boolean; t: SharedValue<number> } {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(open);
  const t = useSharedValue(0);
  useEffect(() => {
    if (open) {
      setMounted(true);
      t.value = spring(1, 'smooth');
      return;
    }
    t.value = timing(0, 'fast', 'accelerate');
    const timer = setTimeout(() => setMounted(false), reduced ? 0 : motion.duration.fast);
    return () => clearTimeout(timer);
  }, [open, reduced, t]);
  return { mounted, t };
}

export interface OverlayProps {
  open: boolean;
  /** Back on Android, Escape in a browser, the scrub of VoiceOver, and a press outside if `dismissible`. */
  onClose: () => void;
  /** It darkens what is behind. Default: true. */
  veil?: boolean;
  /** A press outside closes it. Default: true. */
  dismissible?: boolean;
  /** Once the window is on the screen. */
  onShow?: () => void;
  /** The panel, given `t`, in a box as big as the screen. */
  children: (t: SharedValue<number>) => ReactNode;
}

export function Overlay({ open, onClose, veil = true, dismissible = true, onShow, children }: OverlayProps) {
  const theme = useTheme();
  const { mounted, t } = useOverlay(open);
  const fade = useAnimatedStyle(() => ({ opacity: t.value }));
  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose} onShow={onShow}>
      <View style={StyleSheet.absoluteFill} onAccessibilityEscape={onClose}>
        {veil && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.color['surface.overlay'] }, fade]} />}
        {/* Outside the panel. A screen reader does not find it: it has the handle, the buttons and its own gesture. */}
        <Pressable aria-hidden accessible={false} tabIndex={-1} style={StyleSheet.absoluteFill} onPress={dismissible ? onClose : undefined} />
        {children(t)}
        {/* A notice of the app called while this is open would be behind it. */}
        <ToastLayer />
      </View>
    </Modal>
  );
}
