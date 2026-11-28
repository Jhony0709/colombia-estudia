import { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { Button, Message, Stack, useTheme } from '@fluxus-ui/native';
import { Audio } from '@fluxus-ui/native/audio';
import { copy } from '../copy';
import { openBrowser } from '../ui/browser';
import { mediaUrl, type ChatMessage } from './api';

type Media = NonNullable<ChatMessage['media']>;

/** La URL firmada caduca: se pide al montar y de nuevo si falla. */
function useSignedUrl(path: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    mediaUrl(path)
      .then((next) => live && setUrl(next))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [path]);
  return url;
}

function Voice({ path }: { path: string }) {
  const url = useSignedUrl(path);
  const [failed, setFailed] = useState(false);
  return (
    <Stack gap="2">
      <Audio
        source={url ? { uri: url } : null}
        labels={{ play: copy.audio.play, pause: copy.audio.pause, position: copy.audio.position }}
        onError={() => setFailed(true)}
      />
      {failed && <Message tone="danger">{copy.loadFailed}</Message>}
    </Stack>
  );
}

function Photo({ path, name }: { path: string; name: string | null }) {
  const theme = useTheme();
  const url = useSignedUrl(path);
  if (!url) return null;
  return (
    <Image
      source={{ uri: url }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={name ? `${copy.photo}: ${name}` : copy.photo}
      resizeMode="cover"
      style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: theme.size['radius.control'] }}
    />
  );
}

/** Lo que mandó por el chat (como `apps/web/app/(staff)/mensajes/message-media.tsx`). */
export function MediaMessage({ media }: { media: Media }) {
  if (media.type === 'audio') return <Voice path={media.url} />;
  if (media.type === 'image' || media.type === 'sticker')
    return <Photo path={media.url} name={media.name} />;
  return (
    <Button
      variant="secondary"
      role="link"
      // El video y el documento, en el visor del navegador de la app.
      onPress={() => mediaUrl(media.url).then(openBrowser)}
    >
      {media.type === 'video' ? copy.video : copy.file(media.name)}
    </Button>
  );
}
