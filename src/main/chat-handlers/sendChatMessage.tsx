import { IpcMainInvokeEvent } from 'electron'
import { ChatMessageType, MessageDetails } from '@types'
import { startOaiChat } from './openai'

export default async function sendChatMessage(
  _event: IpcMainInvokeEvent,
  { userInput, highlightedText }: MessageDetails
): Promise<ChatMessageType> {
  // give this message an id
  return startOaiChat({ userInput, highlightedText })
}
