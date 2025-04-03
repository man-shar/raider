import { IpcMainInvokeEvent } from 'electron'
import { removeConversationInDb } from '../db/chatUtils'

export function removeConversation(
  _event: IpcMainInvokeEvent,
  path: string,
  is_url: number,
  name: string,
  conversationId: string
) {
  return removeConversationInDb({ path, is_url, name, conversationId })
}
