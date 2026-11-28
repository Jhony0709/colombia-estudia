/**
 * `@fluxus-ui/native/screen`: the ground of a screen, inside the safe area. Its own entry, so that an app that
 * lays out its screens some other way does not need react-native-safe-area-context. (SPEC §15.5)
 */
import type { ComponentRef, Ref } from 'react';
import { ScrollView, View, type ScrollViewProps, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from './theme';

export interface ScreenProps extends ViewProps {
  /** It scrolls, and the keyboard does not cover the field in use. */
  scroll?: boolean;
  /** Which sides keep clear of the notch and the bars. Default: all. With a header or a tab bar, leave theirs out. */
  edges?: readonly Edge[];
  /** The gutter of the theme around what it holds, and its gap between. Default: true. */
  padded?: boolean;
  /** With `scroll`: its ScrollView, to take it somewhere (`scrollToEnd` in a chat). */
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
  /** With `scroll`: what else its ScrollView takes (`onScroll`, `testID`…). Its padding stays the one of the theme. */
  scrollProps?: Omit<ScrollViewProps, 'children'>;
}

export function Screen({ scroll = false, edges, padded = true, scrollRef, scrollProps, style, children, ...rest }: ScreenProps) {
  const theme = useTheme();
  const inner = padded ? { padding: theme.size['layout.gutter'], gap: theme.size['space.4'] } : null;
  return (
    <SafeAreaView edges={edges} {...rest} style={[{ flex: 1, backgroundColor: theme.color['surface.page'] }, style]}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets {...scrollProps} ref={scrollRef} contentContainerStyle={[inner, scrollProps?.contentContainerStyle]}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
