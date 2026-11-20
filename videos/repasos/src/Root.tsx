import { Composition } from 'remotion';
import { Video, repasoFor } from './Video';
import { FPS, H, W } from './theme';
import { TIMINGS } from './timings';

// Una composición por tema y voz con tiempos listos (src/timings/<tema>--<voz>.json).
export const RemotionRoot = () => (
  <>
    {Object.keys(TIMINGS).map((key) => (
      <Composition
        key={key}
        id={`Repaso-${key.replace('--', '-')}`}
        component={Video}
        defaultProps={{ repaso: key }}
        durationInFrames={(repasoFor(key)?.escenas ?? []).reduce((sum, s) => sum + s.frames, 0)}
        fps={FPS}
        width={W}
        height={H}
      />
    ))}
  </>
);
