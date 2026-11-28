import type { ReactNode } from 'react';
import { TextInput, View } from 'react-native';
import { plus, send } from '@fluxus-ui/icons';
import { Button, textStyle, useTheme } from '@fluxus-ui/native';
import { Icon } from '@fluxus-ui/native/icon';
import { copy } from '../copy';

const t = copy.chat;
const MAX_LINES = 6;

/** La franja de abajo del chat, siempre a la vista y sobre el teclado. */
export function ChatBar({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const s = theme.size;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: s['space.2'],
        paddingHorizontal: s['space.3'],
        paddingVertical: s['space.2'],
        borderTopWidth: 1,
        borderTopColor: theme.color['border.default'],
        backgroundColor: theme.color['surface.raised'],
      }}
    >
      {children}
    </View>
  );
}

/** Un botón redondo con un icono, del tamaño de un dedo: el icono toma su color y se mueve al pulsarlo. */
function round(theme: ReturnType<typeof useTheme>) {
  const side = theme.size['target.min'];
  return {
    width: side,
    height: side,
    minHeight: side,
    borderRadius: side / 2,
    paddingHorizontal: 0,
  };
}

/** El «+» del chat: lo que no es escribir (cerrar, la web). */
export function MoreButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Button variant="ghost" aria-label={t.more} onPress={onPress} style={round(theme)}>
      <Icon icon={plus} size="lg" />
    </Button>
  );
}

/** Escribir y enviar, como en WhatsApp: el campo crece hasta seis líneas y enviar se apaga si está vacío. */
export function Composer({
  value,
  onChange,
  onSend,
  onMore,
}: {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  onMore: () => void;
}) {
  const theme = useTheme();
  const s = theme.size;
  const text = textStyle(theme);
  const line = text.lineHeight ?? s['target.min'] / 2;
  const empty = value.trim() === '';
  return (
    <ChatBar>
      <MoreButton onPress={onMore} />
      <TextInput
        aria-label={copy.reply}
        placeholder={t.placeholder}
        placeholderTextColor={theme.color['text.muted']}
        value={value}
        onChangeText={onChange}
        multiline
        textAlignVertical="center"
        style={[
          text,
          {
            flex: 1,
            minHeight: s['target.min'],
            maxHeight: MAX_LINES * line + 2 * s['space.2'],
            paddingHorizontal: s['space.4'],
            paddingVertical: s['space.2'],
            borderRadius: s['target.min'] / 2,
            borderWidth: 1,
            borderColor: theme.color['border.default'],
            backgroundColor: theme.color['input.bg'],
          },
        ]}
      />
      <Button
        variant="primary"
        aria-label={copy.send}
        disabled={empty}
        onPress={onSend}
        style={round(theme)}
      >
        <Icon icon={send} />
      </Button>
    </ChatBar>
  );
}
