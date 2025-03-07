import { ElectronAPI } from '@electron-toolkit/preload'

export interface ChatMessageType {
  id: string
  userInput: string
  highlightedText: string | null
  highlightId: string | null
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
  highlightedText: string | null
  highlightId: string | null
  file: RaiderFile | null
  fileText: string | null
}

export interface ChatAPI {
  sendChatMessage: (details: MessageDetails) => Promise<ChatMessageType | { error: string }>
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
  // A highlight can be of two types:
  // 1. Simple highlight - just highlighted text without any conversation
  // 2. Conversation highlight - highlighted text that has an associated chat conversation
  id: string
  fullText: string
  comment: string
  originalViewportWidth: number
  pageNumber: number
  has_conversation?: boolean
  conversation_id?: string
  // one highlight can span multiple lines/pages
  // so have to store the individual chunks
  chunks: {
    x: number
    y: number
    width: number
    height: number
  }[]
}

export type FileDetailsKeys = 'fullText' | 'pageWiseText'
export type FileDetails = { [key in FileDetailsKeys]: any }

export interface RaiderFile {
  path: string
  is_url: number
  name: string
  highlights: HighlightType[]
  chat_history: []
  buf?: { data: Array<number> }
  type?: string
  details: FileDetails
}

export interface RaiderFileDbRow {
  path: string
  is_url: number
  name: string
  highlights: string
  chat_history: string
  details: string
}

export interface FileAPI {
  selectFile: () => Promise<{ files?: RaiderFile[]; error?: string }>
  openURL: (url: string) => Promise<{ file?: RaiderFile; error?: string }>
  updateHighlights: (
    path: string,
    highlights: HighlightType[]
  ) => Promise<{ error?: string; newHighlights?: HighlightType[] }>
  closeFile: (path: string) => Promise<{ error?: string }>
  getOpenFiles: () => Promise<RaiderFile[]>
  updateFileDetails: (
    path: string,
    is_url: number,
    name: string,
    details: FileDetails
  ) => Promise<{ error?: string }>
}

declare global {
  interface Window {
    electron: ElectronAPI
    chat: ChatAPI
    fileHandler: FileAPI
  }
  type Listener = () => void
}
