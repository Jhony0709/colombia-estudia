/**
 * `@fluxus-ui/native/icon`: an icon of @fluxus-ui/icons, drawn with react-native-svg. Its own entry, so that an app
 * that draws no icons does not need the library. Still: the motion of the icons is not here yet. (SPEC §15.5)
 */
import Svg, { Path } from 'react-native-svg';
import { useTheme } from './theme';

/** What an icon of @fluxus-ui/icons is, as far as drawing it at rest goes: outlines on a 16 × 16 grid. */
export interface IconData {
  parts: readonly { id: string; d: string; fill?: boolean; rest?: { d?: string; o?: number; draw?: number | 'p' } }[];
}

export interface IconProps {
  icon: IconData;
  /** A size of the theme, or points. Default: 'md'. */
  size?: 'sm' | 'md' | 'lg' | number;
  /** Default: the colour of the text. */
  color?: string;
  /** What it means, for a screen reader. Without it the icon is decoration: the text beside it says it. */
  label?: string;
  testID?: string;
}

export function Icon({ icon, size = 'md', color, label, testID }: IconProps) {
  const theme = useTheme();
  const side = typeof size === 'number' ? size : theme.size[`icon.${size}`];
  const ink = color ?? theme.color['text.default'];
  const a11y = label ? ({ accessible: true, accessibilityRole: 'image', accessibilityLabel: label } as const) : ({ accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const);
  return (
    <Svg testID={testID} width={side} height={side} viewBox="0 0 16 16" fill="none" stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...a11y}>
      {icon.parts
        // A part that is hidden at rest only shows in another state of the icon.
        .filter((p) => p.rest?.o !== 0 && p.rest?.draw !== 0)
        .map((p) => (
          <Path key={p.id} d={p.rest?.d ?? p.d} opacity={p.rest?.o} fill={p.fill ? ink : undefined} />
        ))}
    </Svg>
  );
}
