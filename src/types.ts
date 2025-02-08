import { ElectronAPI } from '@electron-toolkit/preload'

export interface ChatMessageType {
  id: string
  userInput: string
  highlightedText: string
  timestamp: string
  response: string
  messages: { role: string; content: string }[]
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

// ---- File related types
export interface HighlightType {
  fullText: string
  comment: string
  originalViewportWidth: number
  pageNumber: number
  // one highlight can span multiple lines/pages
  // so have to store the individual chunks
  chunks: {
    x: number
    y: number
    width: number
    height: number
  }[]
}
export type FileHighlights = HighlightType[]

export interface RaiderFile {
  path: string
  is_url: number
  name: string
  highlights: FileHighlights
  chat_history: []
  buf?: { data: Array<number> }
  type?: string
}

export interface RaiderFileDbRow {
  path: string
  is_url: number
  name: string
  highlights: string
  chat_history: string
}

export interface FileAPI {
  selectFile: () => Promise<{ files?: RaiderFile[]; error?: string }>
  openURL: (url: string) => Promise<{ file?: RaiderFile; error?: string }>
  updateHighlights: (
    path: string,
    highlights: FileHighlights
  ) => Promise<{ error?: string; newHighlights?: FileHighlights }>
  closeFile: (path: string) => Promise<{ error?: string }>
  getOpenFiles: () => Promise<RaiderFile[]>
}

declare global {
  interface Window {
    electron: ElectronAPI
    chat: ChatAPI
    fileHandler: FileAPI
  }
}
