import { IpcMainInvokeEvent } from 'electron'
import { ConversationType, MessageDetails } from '@types'
import { startOaiChat } from './openai'

export default async function sendChatMessage(
  _event: IpcMainInvokeEvent,
  { conversation, userInput, highlightedText, highlightId, file, fileText }: MessageDetails
): Promise<ConversationType | { error: string }> {
  // give this message an id
  return startOaiChat({ conversation, userInput, highlightedText, highlightId, file, fileText })
}
