/**
 * A window in the middle of the screen: a title, what it says and its buttons. It comes growing a little as it
 * shows. `ConfirmDialog` is the one that asks before acting, and waits for the answer of the app. (SPEC §15.8)
 */
import { useRef, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { ScrollView, StyleSheet, Text as NativeText, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Button, type ButtonVariant } from './Button';
import { floating, focusOn, Overlay } from './overlay';
import { settle } from './pending';
import { Text } from './Text';
import { useTheme } from './theme';

/** As wide as on the web (ui/css/dialog.css), and how small it starts. */
const WIDEST = 512;
const SMALL = 0.96;

export interface DialogProps {
  open: boolean;
  /** A press outside (unless `alert`) and back. Its buttons close it by calling this too. */
  onClose: () => void;
  title: string;
  /** Under the title, muted. */
  description?: string;
  children?: ReactNode;
  /** The buttons, at the end. */
  actions?: ReactNode;
  /** It asks something that must be answered: a press outside does not close it, and it is an `alertdialog`. */
  alert?: boolean;
  testID?: string;
}

function Panel({ t, title, description, children, actions, alert, testID, heading }: Omit<DialogProps, 'open' | 'onClose'> & { t: SharedValue<number>; heading: RefObject<ComponentRef<typeof NativeText> | null> }) {
  const theme = useTheme();
  const grow = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ scale: SMALL + (1 - SMALL) * t.value }] }));
  const gap = theme.size['space.4'];
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: gap }]}>
      <Animated.View role={alert ? 'alertdialog' : 'dialog'} aria-modal accessibilityViewIsModal aria-label={title} testID={testID} style={[floating(theme), { width: '100%', maxWidth: WIDEST, maxHeight: '100%', padding: theme.size['space.5'], gap }, grow]}>
        {/* What it says scrolls if it does not fit, with a big text size; its buttons stay in sight. */}
        <ScrollView bounces={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ gap }}>
          <View style={{ gap: theme.size['space.1'] }}>
            <Text ref={heading} variant="title">
              {title}
            </Text>
            {description !== undefined && <Text tone="muted">{description}</Text>}
          </View>
          {children}
        </ScrollView>
        {actions != null && <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: theme.size['space.2'] }}>{actions}</View>}
      </Animated.View>
    </View>
  );
}

export function Dialog({ open, onClose, alert, ...rest }: DialogProps) {
  const heading = useRef<ComponentRef<typeof NativeText>>(null);
  return (
    <Overlay open={open} onClose={onClose} dismissible={!alert} onShow={() => focusOn(heading.current)}>
      {(t) => <Panel t={t} alert={alert} heading={heading} {...rest} />}
    </Overlay>
  );
}

export interface ConfirmDialogProps extends Pick<DialogProps, 'open' | 'onClose' | 'title' | 'description' | 'children' | 'testID'> {
  /** What the button that confirms says. */
  confirm: string;
  /** What the other says. Default: 'Cancel'. */
  cancel?: string;
  /** Default: 'primary'; 'danger' to delete. */
  confirmVariant?: ButtonVariant;
  /** If it returns a promise, the button waits for it and the dialog closes once it is fulfilled. If it fails it stays: say why in `children`. */
  onConfirm: () => void | Promise<unknown>;
}

/** It asks before acting, with the names of `ConfirmButton` on the web. */
export function ConfirmDialog({ confirm, cancel = 'Cancel', confirmVariant = 'primary', onConfirm, onClose, ...rest }: ConfirmDialogProps) {
  return (
    <Dialog
      alert
      onClose={onClose}
      {...rest}
      actions={
        <>
          <Button onPress={onClose}>{cancel}</Button>
          <Button variant={confirmVariant} onPress={() => settle(onConfirm(), onClose)}>
            {confirm}
          </Button>
        </>
      }
    />
  );
}
