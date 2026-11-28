/**
 * The motion vocabulary of Fluxus on Reanimated: the same names, durations and
 * springs as the web (core/src/tokens.ts). With reduced motion on in the system,
 * a value goes to its end at once. (SPEC §15)
 */
import { Easing, ReduceMotion, withSpring, withTiming } from 'react-native-reanimated';
import { motion } from './generated/tokens';

export type SpringPreset = keyof typeof motion.spring;
export type DurationToken = keyof typeof motion.duration;
export type EasingToken = keyof typeof motion.easing;

export const spring = (to: number, preset: SpringPreset = 'smooth'): number => {
  'worklet';
  return withSpring(to, { ...motion.spring[preset], reduceMotion: ReduceMotion.System });
};

export const timing = (to: number, duration: DurationToken = 'normal', easing: EasingToken = 'standard'): number => {
  'worklet';
  const [a, b, c, d] = motion.easing[easing];
  return withTiming(to, { duration: motion.duration[duration], easing: Easing.bezier(a, b, c, d), reduceMotion: ReduceMotion.System });
};
