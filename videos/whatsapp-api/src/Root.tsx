import { Composition } from 'remotion';
import { Video } from './Video';
import { FPS, H, W } from './theme';
import timings from './timings.json';

const total = timings.reduce((sum, s) => sum + s.frames, 0);

export const RemotionRoot = () => (
  <Composition
    id="WhatsappApi"
    component={Video}
    durationInFrames={total}
    fps={FPS}
    width={W}
    height={H}
  />
);
