import { IpcMainInvokeEvent } from 'electron'
import { ChatMessage } from '@types'

export default async function sendChatMessage(
  _event: IpcMainInvokeEvent,
  message: string
): Promise<ChatMessage> {
  return {
    prompt: message,
    timestamp: new Date().toISOString(),
    response: `This is a response to the message: ${message}`,
    metadata: {
      model_name: 'gpt-3.5-turbo'
    }
  }
}
