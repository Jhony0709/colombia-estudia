/**
 * Lo que admite cada canal al responder desde `/mensajes` (22/11). La bandeja pinta sus
 * opciones con esto: un canal nuevo (Instagram, …) es otra entrada aquí.
 */

export type MessagingChannel = 'WHATSAPP';

export interface ChannelFeatures {
  /** Sintaxis de formato que el canal muestra (`*negrita*`…); nula si es texto plano. */
  format: 'whatsapp' | null;
  /** Responder citando un mensaje. */
  quote: boolean;
  /** Botones de respuesta rápida: cuántos y de qué largo. */
  buttons: { max: number; titleMax: number } | null;
  /** Fuera de la ventana de servicio se escribe solo con plantilla. */
  templates: boolean;
}

export const CHANNEL_FEATURES: Record<MessagingChannel, ChannelFeatures> = {
  WHATSAPP: {
    format: 'whatsapp',
    quote: true,
    buttons: { max: 3, titleMax: 20 },
    templates: true,
  },
};
