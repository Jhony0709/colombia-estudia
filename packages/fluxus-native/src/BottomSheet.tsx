/**
 * A sheet that rises from the bottom, moved only by its transform. As tall as what it holds, up to nine tenths
 * of the screen. Dragged down from its header, it goes; so it does with its handle, which is a button with a
 * name for whoever cannot drag. (SPEC §15.8)
 */
import { useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { PanResponder, Pressable, ScrollView, Text as NativeText, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { spring } from './motion';
import { floating, focusOn, Overlay } from './overlay';
import { Text } from './Text';
import { useTheme } from './theme';

/** How much of the screen it may take, how far down it must be let go to close, and how fast a flick is. */
const TALLEST = 0.9;
const CLOSE_AT = 0.3;
const FLICK = 0.8;

export interface BottomSheetProps {
  open: boolean;
  /** A press outside, back, the handle, or dragging it down. */
  onClose: () => void;
  /** Its name: at the top, and what a screen reader hears on opening. */
  title: string;
  /** The title is only for a screen reader. */
  titleHidden?: boolean;
  children?: ReactNode;
  /** What the bottom edge of the screen takes: the safe area of the app. It is added to its own padding. Default: 0. */
  inset?: number;
  /** The name of the handle, for a screen reader. Default: 'Close'. */
  closeLabel?: string;
  /** A press outside or a drag closes it, and it has a handle. Default: true. Back always closes. */
  dismissible?: boolean;
  /** What does not fit scrolls. Default: true; false when what it holds scrolls by itself. */
  scroll?: boolean;
  testID?: string;
}

function Sheet({ t, onClose, title, titleHidden, children, inset, closeLabel = 'Close', dismissible = true, scroll = true, testID, heading }: Omit<BottomSheetProps, 'open'> & { t: SharedValue<number>; heading: RefObject<ComponentRef<typeof NativeText> | null> }) {
  const theme = useTheme();
  const { height: screen } = useWindowDimensions();
  const [height, setHeight] = useState(0);
  const drag = useSharedValue(0);
  // Until it is measured it waits below the screen, wherever that is.
  const far = height || screen;
  const rise = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - t.value) * far + drag.value }] }));
  const latest = useRef({ height, onClose });
  latest.current = { height, onClose };
  const [pan] = useState(() =>
    PanResponder.create({
      // Only a drag down, and only from the header: what it holds may scroll.
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        drag.value = Math.max(0, g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > latest.current.height * CLOSE_AT || g.vy > FLICK) latest.current.onClose();
        else drag.value = spring(0, 'snappy');
      },
      onPanResponderTerminate: () => {
        drag.value = spring(0, 'snappy');
      },
    }),
  );
  const radius = theme.size['radius.card'];
  const pad = theme.size['space.4'];
  const body = <View style={{ paddingInline: pad, paddingBottom: pad + (inset ?? 0) }}>{children}</View>;
  return (
    <Animated.View
      role="dialog"
      aria-modal
      accessibilityViewIsModal
      aria-label={title}
      testID={testID}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      style={[floating(theme), { position: 'absolute', start: 0, end: 0, bottom: 0, maxHeight: screen * TALLEST, borderBottomWidth: 0, borderBottomStartRadius: 0, borderBottomEndRadius: 0, borderTopStartRadius: radius, borderTopEndRadius: radius }, rise]}
    >
      <View {...(dismissible ? pan.panHandlers : null)} style={{ paddingInline: pad, paddingBottom: theme.size['space.3'] }}>
        {dismissible && (
          <Pressable role="button" aria-label={closeLabel} onPress={onClose} hitSlop={theme.size['space.3']} style={{ alignSelf: 'center', paddingBlock: theme.size['space.2'] }}>
            <View style={{ width: theme.size['space.10'], height: theme.size['space.1'], borderRadius: theme.size['space.1'], backgroundColor: theme.color['border.strong'] }} />
          </Pressable>
        )}
        {!titleHidden && (
          // Not selectable: in a browser, a drag that selects text is not a drag of the sheet.
          <Text ref={heading} variant="title" selectable={false} style={dismissible ? null : { paddingTop: pad }}>
            {title}
          </Text>
        )}
      </View>
      {scroll ? (
        <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </Animated.View>
  );
}

export function BottomSheet({ open, onClose, dismissible = true, ...rest }: BottomSheetProps) {
  const heading = useRef<ComponentRef<typeof NativeText>>(null);
  return (
    <Overlay open={open} onClose={onClose} dismissible={dismissible} onShow={() => focusOn(heading.current)}>
      {(t) => <Sheet t={t} onClose={onClose} dismissible={dismissible} heading={heading} {...rest} />}
    </Overlay>
  );
}
