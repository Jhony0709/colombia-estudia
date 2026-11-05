import 'server-only';

/**
 * WhatsApp de la institución (5/11): el id del número en Meta (con él el webhook sabe de qué
 * institución es lo que llega) y los WhatsApp de quienes atienden la bandeja, a quienes se avisa
 * cuando alguien pide un asesor. Aparte del formulario de la institución, con su propio botón.
 */

import { createTenantClient } from '@/lib/db/tenant';
import { APIError } from '@/lib/core/errors';
import { isUniqueViolation } from '@/lib/db/errors';

export interface WhatsAppSettings {
  phoneNumberId: string | null;
  /** Con indicativo y solo dígitos (`573102502207`). */
  agentPhones: string[];
}

/**
 * Lo que se escribe en el formulario, a `wa_id`: solo dígitos y sin el 0 de marcación nacional
 * que algunos ponen tras el indicativo (`+33 06…` → `336…`). Sin indicativo no vale.
 */
export function normalizeAgentPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('+')) return null;
  let digits = trimmed.replace(/\D/g, '');
  // +33 0 6…: el 0 sobra en formato internacional (Francia, Reino Unido, Italia no).
  if (digits.startsWith('330') || digits.startsWith('440'))
    digits = digits.slice(0, 2) + digits.slice(3);
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export async function getWhatsAppSettings(institutionId: string): Promise<WhatsAppSettings> {
  const db = createTenantClient(institutionId);
  const row = await db.institution.findUniqueOrThrow({
    where: { id: institutionId },
    select: { whatsappPhoneNumberId: true, whatsappAgentPhones: true },
  });
  return { phoneNumberId: row.whatsappPhoneNumberId, agentPhones: row.whatsappAgentPhones };
}

export async function updateWhatsAppSettings({
  institutionId,
  actorId,
  phoneNumberId,
  agentPhones,
}: {
  institutionId: string;
  actorId: string | null;
  phoneNumberId: string | null;
  agentPhones: string[];
}): Promise<WhatsAppSettings> {
  const phones: string[] = [];
  for (const raw of agentPhones) {
    const phone = normalizeAgentPhone(raw);
    if (!phone) {
      throw new APIError(`«${raw}» no es un número con indicativo (+57…)`, 'VALIDATION_ERROR');
    }
    if (!phones.includes(phone)) phones.push(phone);
  }
  const db = createTenantClient(institutionId);
  try {
    return await db.$transaction(async (tx) => {
      const before = await tx.institution.findUniqueOrThrow({
        where: { id: institutionId },
        select: { whatsappPhoneNumberId: true, whatsappAgentPhones: true },
      });
      const after = await tx.institution.update({
        where: { id: institutionId },
        data: { whatsappPhoneNumberId: phoneNumberId, whatsappAgentPhones: phones },
        select: { whatsappPhoneNumberId: true, whatsappAgentPhones: true },
      });
      await tx.auditLog.create({
        data: {
          institutionId,
          actorId,
          entity: 'institution',
          entityId: institutionId,
          action: 'whatsapp_updated',
          before,
          after,
        },
      });
      return { phoneNumberId: after.whatsappPhoneNumberId, agentPhones: after.whatsappAgentPhones };
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new APIError('Ese número de WhatsApp ya está en otra institución', 'CONFLICT');
    }
    throw err;
  }
}
