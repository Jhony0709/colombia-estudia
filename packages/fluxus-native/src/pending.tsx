/**
 * The wait is born from the finger, as on the web (core/src/pending.ts, SPEC §14.35): what was pressed and now
 * waits fills slowly from where it was touched, never to the whole; when the answer comes it fills and goes,
 * and if it failed it drains back to the finger. A wait shorter than 150 ms shows nothing; once seen, it lasts
 * 400 ms at least. (SPEC §15.6, §15.9)
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { motion } from './generated/tokens';

const DELAY = 150;
const MIN_VISIBLE = 400;
/** How far it gets by itself, of the way to the farthest corner, and the weight of its colour. */
const REACH = 0.9;
const TINT = 0.14;

/**
 * `onPress` may return a promise: until it settles, what was pressed waits. If it is rejected, it failed: the
 * third value is true until the next press. The rejection goes no further: the app has its own `catch`.
 */
export function useAsyncPress<E>(onPress: ((event: E) => unknown) | null | undefined): [waiting: boolean, run: (event: E) => void, failed: boolean] {
  const [state, setState] = useState<'idle' | 'waiting' | 'failed'>('idle');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const run = (event: E): void => {
    const result = onPress?.(event) as PromiseLike<unknown> | undefined;
    if (typeof result?.then !== 'function') return;
    setState('waiting');
    const end = (next: 'idle' | 'failed') => (): void => {
      if (alive.current) setState(next);
    };
    result.then(end('idle'), end('failed'));
  };
  return [state === 'waiting', run, state === 'failed'];
}

/** `done` runs once `result` is fulfilled if it is a promise, and at once if it is not. If it fails, it does not run. */
export function settle(result: unknown, done: () => void): void | Promise<void> {
  const promise = result as PromiseLike<unknown> | undefined;
  if (typeof promise?.then !== 'function') return done();
  return Promise.resolve(promise).then(done, () => undefined);
}

interface FillProps {
  x: number;
  y: number;
  /** As far as the farthest corner. */
  radius: number;
  ink: string;
  /** How the wait ended, once it has. */
  ending: false | 'done' | 'failed';
}

/** Mounted only while something waits: at rest, what can wait carries no animated view. */
function Fill({ x, y, radius, ink, ending }: FillProps) {
  const reduced = useReducedMotion();
  const grow = useSharedValue(reduced ? 1 : 0);
  const fade = useSharedValue(1);
  useEffect(() => {
    const fast = motion.duration.fast;
    if (ending === 'failed') grow.value = withTiming(0, { duration: motion.duration.normal, reduceMotion: ReduceMotion.System });
    else if (ending) {
      grow.value = withTiming(1, { duration: fast, reduceMotion: ReduceMotion.System });
      fade.value = withDelay(fast, withTiming(0, { duration: fast, reduceMotion: ReduceMotion.System }));
      // It slows as it goes and never gets there: it does not pretend to know how long.
    } else if (!reduced) grow.value = withTiming(REACH, { duration: 4000, easing: Easing.out(Easing.exp) });
  }, [ending, reduced, grow, fade]);
  const style = useAnimatedStyle(() => ({ opacity: fade.value * TINT, transform: [{ scale: grow.value }] }));
  // Where the finger was, in the points of the element: `left` and `top`, not the direction of the language.
  return <Animated.View pointerEvents="none" aria-hidden style={[{ position: 'absolute', left: x - radius, top: y - radius, width: 2 * radius, height: 2 * radius, borderRadius: radius, backgroundColor: ink }, style]} />;
}

/**
 * For what is pressed and may wait. Give it `onPressIn` and `onLayout`, put `fill` first inside it, and clip it
 * (`overflow: 'hidden'`). `ink` is the colour of its text; `failed`, whether the wait that ends now did.
 */
export function usePending(waiting: boolean, ink: string, failed = false): { onPressIn: (e: GestureResponderEvent) => void; onLayout: (e: LayoutChangeEvent) => void; fill: ReactNode } {
  const [phase, setPhase] = useState<'idle' | 'shown' | 'done' | 'failed'>('idle');
  const how = useRef(failed);
  how.current = failed;
  const origin = useRef<{ x: number; y: number } | null>(null);
  const size = useRef({ w: 0, h: 0 });
  const since = useRef(0);
  useEffect(() => {
    if (waiting) {
      const timer = setTimeout(() => {
        since.current = Date.now();
        setPhase('shown');
      }, DELAY);
      return () => clearTimeout(timer);
    }
    if (phase !== 'shown') return;
    let last: ReturnType<typeof setTimeout>;
    const timer = setTimeout(
      () => {
        setPhase(how.current ? 'failed' : 'done');
        last = setTimeout(() => setPhase('idle'), how.current ? motion.duration.normal : motion.duration.fast * 2);
      },
      Math.max(0, MIN_VISIBLE - (Date.now() - since.current)),
    );
    return () => {
      clearTimeout(timer);
      clearTimeout(last);
    };
    // `phase` is read, not followed: only a change of `waiting` moves it on.
  }, [waiting]);
  const { w, h } = size.current;
  const at = origin.current ?? { x: w / 2, y: h / 2 };
  return {
    onPressIn(e) {
      // The event gives the point in the window; the element says where it is in it.
      origin.current = null;
      // Pressed with a keyboard there is no point: it fills from the centre.
      if (!e?.nativeEvent) return;
      const { pageX, pageY } = e.nativeEvent;
      (e.currentTarget as unknown as { measureInWindow?: (done: (x: number, y: number) => void) => void } | null)?.measureInWindow?.((x, y) => {
        origin.current = { x: pageX - x, y: pageY - y };
      });
    },
    onLayout(e) {
      size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
    },
    fill: phase === 'idle' ? null : <Fill x={at.x} y={at.y} radius={Math.hypot(Math.max(at.x, w - at.x), Math.max(at.y, h - at.y))} ink={ink} ending={phase === 'shown' ? false : phase} />,
  };
}
