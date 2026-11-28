/**
 * `@fluxus-ui/native/blur`: the Swap that loses focus on a phone too, with the veil of expo-blur over what changes.
 * Its own entry, so that an app without it does not need expo-blur. On Android the blur needs Android 12;
 * below, it only dissolves. (SPEC §15.6)
 */
import { useRef, type ComponentRef } from 'react';
import { StyleSheet, type View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import Animated, { useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import { presence } from './presence';
import { useSwap, type SwapProps } from './Swap';

const Veil = Animated.createAnimatedComponent(BlurView);
/** How blurred it gets at the middle of the change, of the 100 of expo-blur. */
const DEPTH = 40;

export function Swap({ id, children, style, ...rest }: SwapProps) {
  const { content, t, moving } = useSwap(id, children);
  const target = useRef<ComponentRef<typeof View>>(null);
  const body = useAnimatedStyle(() => ({ opacity: 0.4 + 0.6 * t.value }));
  const veil = useAnimatedProps(() => ({ intensity: (1 - t.value) * DEPTH }));
  return (
    <Animated.View layout={presence().layout} {...rest} style={style}>
      <BlurTargetView ref={target}>
        <Animated.View style={body}>{content}</Animated.View>
      </BlurTargetView>
      {/* Only while it changes: at rest there is no veil over the content. */}
      {moving && <Veil pointerEvents="none" blurTarget={target} blurMethod="dimezisBlurViewSdk31Plus" animatedProps={veil} style={StyleSheet.absoluteFill} />}
    </Animated.View>
  );
}

export type { SwapProps };
