/**
 * Nothing jumps: what comes fades in as it rises, what goes fades out, and what
 * stays glides to its new place. The values of the web (core/src/stagger.ts),
 * on the layout animations of Reanimated. With reduced motion on in the system
 * they are immediate. (SPEC §15.4)
 */
import type { ComponentRef, Ref } from 'react';
import { Platform, type ViewProps } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { motion } from './generated/tokens';

const curve = (name: keyof typeof motion.easing) => {
  const [a, b, c, d] = motion.easing[name];
  return Easing.bezier(a, b, c, d);
};
/** How far it rises as it comes, and how long the nth of a group waits for the one before. */
export const RISE = 12;
export const STAGGER = 70;

/** For `entering`: it fades in as it rises; `index` is its place in a group that comes together. */
export const enter = (index = 0) =>
  FadeInDown.duration(motion.duration.normal)
    .delay(index * STAGGER)
    .easing(curve('decelerate'))
    .withInitialValues({ transform: [{ translateY: RISE }] })
    .reduceMotion(ReduceMotion.System);

/** For `exiting`: it fades out, fast. */
export const exit = () => FadeOut.duration(motion.duration.fast).easing(curve('accelerate')).reduceMotion(ReduceMotion.System);

/** For `layout`: it glides to where it is now, on the smooth spring. */
export const shift = () => {
  const { stiffness, damping, mass } = motion.spring.smooth;
  return LinearTransition.springify().stiffness(stiffness).damping(damping).mass(mass).reduceMotion(ReduceMotion.System);
};

interface Presence {
  entering: ReturnType<typeof enter>;
  exiting: ReturnType<typeof exit>;
  layout: ReturnType<typeof shift>;
}
const MADE = new Map<number, Presence>();

/**
 * The three, for a view that comes, goes and moves. In a browser they are off: there Reanimated pins a view
 * that has them where it first was (`position: absolute`, seen with 4.7.1), and the layout breaks.
 */
export const presence = (index = 0): Partial<Presence> => {
  if (Platform.OS === 'web') return {};
  // One set for each place in a group, made once: a render does not build them again.
  let made = MADE.get(index);
  if (!made) MADE.set(index, (made = { entering: enter(index), exiting: exit(), layout: shift() }));
  return made;
};

export interface AppearProps extends ViewProps {
  /** Its place in a group that comes together: each waits a little for the one before. */
  index?: number;
  ref?: Ref<ComponentRef<typeof Animated.View>>;
}

/** A view that comes, goes and moves without a jump. Its siblings glide too when each is an Appear. */
export function Appear({ index = 0, ...rest }: AppearProps) {
  return <Animated.View {...presence(index)} {...rest} />;
}
