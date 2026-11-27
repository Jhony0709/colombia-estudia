/**
 * Los archivos del chat (27/11): audios, fotos y documentos que llegan por WhatsApp. Se bajan
 * de Meta al llegar, porque su enlace caduca, y se guardan en el bucket privado `media`. La
 * bandeja los pide por una ruta propia que firma en cada pedido; se borran con la conversación.
 */

import 'server-only';

import { prisma } from '@/lib/db/tenant';
import { logger } from '@/lib/observability/logger';
import { APIError } from '@/lib/core/errors';
import { createReadUrl, objectPath, putBytes, removeObjects } from '@/lib/media/storage';
import { downloadMedia, type InboundMedia } from '@/lib/whatsapp/cloud-api';

const EXTENSIONS: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/amr': 'amr',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'application/pdf': 'pdf',
};

/** `audio/ogg; codecs=opus` → `ogg`; un documento conserva la extensión de su nombre. */
export function extensionOf(mime: string, filename: string | null): string {
  const fromName = filename?.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  return EXTENSIONS[mime.split(';')[0]!.trim().toLowerCase()] ?? fromName ?? 'bin';
}

/** Baja el archivo y lo deja en el mensaje. Si falla, el mensaje queda como antes: `[audio]`. */
export async function saveInboundMedia({
  institutionId,
  messageId,
  media,
}: {
  institutionId: string;
  messageId: string;
  media: InboundMedia;
}): Promise<void> {
  try {
    const file = await downloadMedia(media.id);
    if (!file) {
      logger.warn({ event: 'chat-media-unavailable', messageId, type: media.type });
      return;
    }
    const mime = media.mime ?? file.mime;
    const path = objectPath({
      institutionId,
      kind: 'chat',
      id: messageId,
      extension: extensionOf(mime, media.filename),
    });
    await putBytes(path, file.bytes, mime.split(';')[0]!.trim());
    await prisma.conversationMessage.update({
      where: { id: messageId },
      data: { mediaPath: path },
    });
  } catch (err) {
    logger.warn({ event: 'chat-media-failed', messageId, type: media.type, error: String(err) });
  }
}

/** Lo que el navegador puede mostrar sin riesgo; lo demás se descarga. */
const INLINE = /^(audio\/[\w.+-]+|image\/(jpeg|png|webp)|video\/(mp4|3gpp))$/;

export function playsInline(mime: string | null): boolean {
  return INLINE.test((mime ?? '').split(';')[0]!.trim().toLowerCase());
}

/** La URL estable de un archivo del chat: firma al pedirla, así no caduca en la página. */
export function chatMediaHref(conversationId: string, messageId: string): string {
  return `/api/conversations/${conversationId}/messages/${messageId}/media`;
}

/** URL firmada de un archivo del chat; `NOT_FOUND` si no es de esa conversación o no se bajó. */
export async function chatMediaUrl({
  institutionId,
  conversationId,
  messageId,
}: {
  institutionId: string;
  conversationId: string;
  messageId: string;
}): Promise<string> {
  const row = await prisma.conversationMessage.findFirst({
    where: { id: messageId, conversationId, institutionId, mediaPath: { not: null } },
    select: { mediaPath: true, mediaMime: true, mediaName: true },
  });
  if (!row?.mediaPath) throw new APIError('Not found', 'NOT_FOUND');
  return createReadUrl(
    row.mediaPath,
    playsInline(row.mediaMime) ? { asAttachment: false } : { fileName: row.mediaName ?? undefined }
  );
}

/** Antes de borrar conversaciones: sus archivos, que la cascada de la base no alcanza. */
export async function removeChatMedia(
  institutionId: string,
  where: { personId?: string | null; lastMessageAt?: { lt: Date } }
): Promise<void> {
  const rows = await prisma.conversationMessage.findMany({
    where: { institutionId, mediaPath: { not: null }, conversation: where },
    select: { mediaPath: true },
  });
  await removeObjects(rows.map((r) => r.mediaPath!));
}
