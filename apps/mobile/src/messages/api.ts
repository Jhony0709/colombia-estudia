import { request } from '../api';

// Las formas de apps/web/features/messaging/server/conversations.service.ts (ConversationRow, ConversationDetail).
export type View = 'waiting' | 'mine' | 'open';

export interface ConversationRow {
  id: string;
  contact: string;
  contactName: string | null;
  personName: string | null;
  status: 'BOT' | 'WAITING' | 'OPEN' | 'CLOSED';
  assignedToName: string | null;
  lastMessageAt: string;
  lastMessage: { body: string; inbound: boolean } | null;
}

export interface ChatMessage {
  id: string;
  inbound: boolean;
  body: string;
  authorName: string | null;
  fromBot: boolean;
  media: { type: string; name: string | null; url: string } | null;
  at: string;
}

export interface Conversation extends ConversationRow {
  assignedToId: string | null;
  canReply: boolean;
  messages: ChatMessage[];
}

export const nameOf = (row: ConversationRow) => row.personName ?? row.contactName ?? row.contact;

export async function listConversations(view: View): Promise<ConversationRow[]> {
  return (await request<{ conversations: ConversationRow[] }>(`/api/conversations?view=${view}`))
    .conversations;
}

export const getConversation = (id: string) => request<Conversation>(`/api/conversations/${id}`);

export const takeConversation = (id: string) =>
  request<unknown>(`/api/conversations/${id}/take`, { method: 'POST' });

export const replyToConversation = (id: string, body: string) =>
  request<unknown>(`/api/conversations/${id}/messages`, { method: 'POST', body: { body } });

export const closeConversation = (id: string) =>
  request<unknown>(`/api/conversations/${id}/close`, { method: 'POST' });

/** La huella de la bandeja, o de un chat con `id` (que además marca que se tiene a la vista). */
export async function pulse(id?: string): Promise<string> {
  const path = id ? `/api/conversations/pulse?id=${id}` : '/api/conversations/pulse';
  return (await request<{ stamp: string }>(path)).stamp;
}

/** La URL firmada del archivo, para el reproductor o el visor. */
export async function mediaUrl(path: string): Promise<string> {
  return (await request<{ url: string }>(`${path}?as=url`)).url;
}
