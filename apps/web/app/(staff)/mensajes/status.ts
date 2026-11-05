import type { BadgeVariant } from '@/components/atoms/badge';
import type { ConversationRow } from '@/features/messaging/server/conversations.service';

/** El color del estado de un chat: lo que espera asesor resalta; lo del bot y lo cerrado, no. */
export const STATUS_VARIANT: Record<ConversationRow['status'], BadgeVariant> = {
  WAITING: 'warning',
  OPEN: 'info',
  BOT: 'neutral',
  CLOSED: 'neutral',
};
