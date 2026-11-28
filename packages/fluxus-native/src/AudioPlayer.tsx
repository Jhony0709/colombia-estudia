/**
 * What plays a sound: a round button, how far it is and the time. It plays nothing by itself: the app, or
 * `@fluxus-ui/native/audio`, tells it where the sound is. The triangle and the bars are drawn with edges,
 * and give way to each other without moving anything else. (SPEC §15.10)
 */
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { fill } from './layout';
import { spring } from './motion';
import { usePress } from './press';
import { Progress } from './Progress';
import { Slider } from './Slider';
import { Text } from './Text';
import { useTheme } from './theme';

export interface AudioPlayerProps extends Omit<ViewProps, 'children' | 'style'> {
  playing: boolean;
  /** Where it is, in seconds. */
  position: number;
  /** How long it is, in seconds; 0 while it is not known. */
  duration: number;
  onToggle: () => void;
  /** With it, the bar is dragged to go to a second; without, it only shows how far it is. */
  onSeek?: (seconds: number) => void;
  /** The names of the button, and of the bar. Default of the bar: 'Position'. */
  labels: { play: string; pause: string; position?: string };
  /** It was asked to play and the sound is not here yet: the button waits, and still takes the press that calls it off. */
  loading?: boolean;
  /** Nothing to play yet. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Seconds as `1:04`. */
export const clock = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

/** What the bar asks for where its row is as wide as what it holds (a bubble); it gives it up where there is no room. */
const BAR = 160;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AudioPlayer({ playing, position, duration, onToggle, onSeek, labels, loading = false, disabled = false, style, ...rest }: AudioPlayerProps) {
  const theme = useTheme();
  const press = usePress({});
  const on = useSharedValue(playing ? 1 : 0);
  useEffect(() => {
    on.value = spring(playing ? 1 : 0, 'snappy');
  }, [playing, on]);
  const wait = useSharedValue(loading ? 1 : 0);
  useEffect(() => {
    wait.value = spring(loading ? 1 : 0, 'snappy');
  }, [loading, wait]);
  // While it waits, neither mark is seen: the spinner is where they were.
  const play = useAnimatedStyle(() => ({ opacity: (1 - on.value) * (1 - wait.value), transform: [{ scale: 1 - 0.4 * on.value }] }));
  const pause = useAnimatedStyle(() => ({ opacity: on.value * (1 - wait.value), transform: [{ scale: 0.6 + 0.4 * on.value }] }));
  const waiting = useAnimatedStyle(() => ({ opacity: wait.value }));
  const side = theme.size['target.min'];
  const ink = theme.color['button.fg'];
  const unit = theme.size['space.1'];
  const name = labels.position ?? 'Position';
  const told = `${clock(position)} / ${clock(duration)}`;
  const at = Math.min(position, duration);
  return (
    <View {...rest} style={[{ flexDirection: 'row', alignItems: 'center', gap: theme.size['space.3'], opacity: disabled ? 0.5 : 1 }, style]}>
      <AnimatedPressable
        role="button"
        aria-label={playing ? labels.pause : labels.play}
        aria-disabled={disabled}
        aria-busy={loading}
        disabled={disabled}
        onPress={onToggle}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[{ width: side, height: side, borderRadius: side / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color['button.bg'] }, press.style]}
      >
        {/* The triangle: three edges of a box with no size. It leans a little to the right, where its weight is. */}
        <Animated.View style={[{ position: 'absolute', marginLeft: unit / 2, width: 0, height: 0, borderTopWidth: unit * 1.75, borderBottomWidth: unit * 1.75, borderLeftWidth: unit * 2.75, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: ink }, play]} />
        <Animated.View style={[{ position: 'absolute', flexDirection: 'row', gap: unit }, pause]}>
          <View style={{ width: unit, height: unit * 3.5, borderRadius: 1, backgroundColor: ink }} />
          <View style={{ width: unit, height: unit * 3.5, borderRadius: 1, backgroundColor: ink }} />
        </Animated.View>
        {/* The spinner of the system, only while it waits: a thread has many players. */}
        {loading && (
          <Animated.View aria-hidden importantForAccessibility="no-hide-descendants" style={[{ position: 'absolute' }, waiting]}>
            <ActivityIndicator size="small" color={ink} />
          </Animated.View>
        )}
      </AnimatedPressable>
      <View style={[fill, { width: BAR, minWidth: theme.size['space.16'] }]}>
        {onSeek && duration > 0 ? (
          <Slider label={name} min={0} max={Math.max(1, Math.floor(duration))} step={1} value={Math.floor(at)} onChange={onSeek} valueText={() => told} disabled={disabled} />
        ) : (
          <Progress label={name} value={at} max={duration || 1} />
        )}
      </View>
      {/* Figures of one width, and room for the longest: the time does not push the bar as it runs. */}
      <Text variant="caption" tone="muted" aria-hidden={!!onSeek && duration > 0} style={{ fontVariant: ['tabular-nums'], minWidth: theme.size['space.16'], textAlign: 'right' }}>
        {told}
      </Text>
    </View>
  );
}
