/**
 * `@fluxus-ui/native/audio`: the player, playing with expo-audio. Its own entry, so that an app with no sound
 * does not need the library. (SPEC §15.10)
 */
import { useEffect, useRef, useState } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, type AudioSource } from 'expo-audio';
import { AudioPlayer, type AudioPlayerProps } from './AudioPlayer';

export interface AudioProps extends Pick<AudioPlayerProps, 'labels' | 'style' | 'testID'> {
  /** What to play: an address, an asset, or null while it is not known (a signed address that is still coming). */
  source: AudioSource;
  /** It could not be played: the app says why. */
  onError?: (message: string) => void;
}

export function Audio({ source, onError, ...rest }: AudioProps) {
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  // Asked to play: the button waits until the sound runs, or until it is known that it will not.
  // In a browser expo-audio says once more that it is not playing at second 0: it is asked until it has moved on.
  const [asked, setAsked] = useState(false);
  const running = status.playing && status.currentTime > 0;
  useEffect(() => {
    if (running || status.error) setAsked(false);
  }, [running, status.error]);
  // Told once for each error, whatever function the app passes on each render.
  const tell = useRef(onError);
  useEffect(() => {
    tell.current = onError;
  });
  useEffect(() => {
    if (status.error) tell.current?.(status.error);
  }, [status.error]);
  const ended = status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration);
  return (
    <AudioPlayer
      {...rest}
      disabled={source === null}
      playing={status.playing || asked}
      loading={asked && !status.playing}
      position={status.currentTime}
      duration={status.duration}
      onToggle={() => {
        if (status.playing || asked) {
          setAsked(false);
          return player.pause();
        }
        setAsked(true);
        // Played to the end, it starts again: once it is back at the start.
        if (ended) return void player.seekTo(0).then(() => player.play());
        player.play();
      }}
      onSeek={(seconds) => void player.seekTo(seconds)}
    />
  );
}
