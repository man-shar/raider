import { ElectronAPI } from '@electron-toolkit/preload'
import { IpcRendererEvent } from 'electron'
import { ChatCompletionRole } from 'openai/resources/index.mjs'

export interface PDFFile {
  file: File
  buf: ArrayBuffer
  metadata: { name: string }
}

export interface ChatMessageType {
  id: string
  userInput: string
  highlightedText: string
  timestamp: string
  response: string
  messages: { role: ChatCompletionRole; content: string }[]
  metadata: {
    model_name: string
  }
}

export interface Chat {
  messages: ChatMessageType[]
}

export interface MessageDetails {
  userInput: string
  highlightedText: string
}

export interface ChatAPI {
  sendChatMessage: (details: MessageDetails) => Promise<ChatMessageType>
  /**
   * Adds a listener for the given `messageId` and calls the `callback`
   * function whenever a chunk of data is received. The callback function
   * receives the chunk of data as a string.
   *
   * Returns a function that can be called to unsubscribe the listener.
   */
  onChunkReceived: (messageId: string, callback: (chunk: string) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    chat: ChatAPI
  }
}
