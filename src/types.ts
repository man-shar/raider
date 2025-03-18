import { ElectronAPI } from '@electron-toolkit/preload'

type MultiModalMessage =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail: string } }
  | { type: 'image'; source: { data: string; media_type: string } }

type MessageContent = string | MultiModalMessage[]

export interface MessageWithHighlights {
  id: string
  role: string
  content: MessageContent
  displayContent?: string
  isLoading?: boolean
  highlightedText?: string | null
  highlightId?: string | null
  terminateString?: string
}

export interface ConversationType {
  id: string
  timestamp: string
  /**
   * Slightly extended message item.
   * The "displayContent" is more for readability purposes on the front end. The prompt is "The user's question is: {userInput}"
   * We will instead only show the {userInput} bit in displayContent
   */
  messages: MessageWithHighlights[]
  tokens?: { prompt: number; cachedInput: number; completion: number }
  totalCost?: number
  metadata: {
    model_name: string
    provider: string
  }
}

export interface ImageData {
  id: string
  base64: string
  loading: boolean
}

export interface NewMessageDetails {
  conversationId: string | null
  userInput: string
  highlightedText: string | null
  highlightId: string | null
  file: RaiderFile | null
  fileText: string | null
  providerId?: ProviderType
  images?: ImageData[] // Array of base64 encoded images
}

export interface AIModel {
  id: string
  name: string
  provider: string
}

export type ProviderType = 'openai' | 'anthropic' | 'google' | 'deepseek'

export interface ProviderSettings {
  apiKey: string
  selectedModel: string
  isEnabled: boolean
}

export interface ProviderConfigDbRow {
  id: string
  name: string
  settings: string
}

export interface ProviderConfig {
  id: ProviderType
  name: string
  settings: ProviderSettings
  models?: AIModel[]
}

export interface ChatAPI {
  sendChatMessage: (details: NewMessageDetails) => Promise<ConversationType | { error: string }>
  /**
   * Adds a listener for the given `messageId` and calls the `callback`
   * function whenever a chunk of data is received. The callback function
   * receives the chunk of data as a string.
   *
   * Returns a function that can be called to unsubscribe the listener.
   */
  onChunkReceived: (messageId: string, callback: (chunk: string) => void) => () => void

  // Provider and model management
  getProviders: () => Promise<ProviderConfig[]>
  updateProviderSettings: (
    providerId: ProviderType,
    settings: Partial<ProviderSettings>
  ) => Promise<{ success: boolean }>
  getActiveProvider: () => Promise<ProviderType>
  setActiveProvider: (providerId: ProviderType) => Promise<{ success: boolean }>
  getAvailableModels: (
    providerId: ProviderType
  ) => Promise<{ models: AIModel[]; error: string | null }>
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
  conversation_history: ConversationType[]
  buf?: { data: Array<number> }
  type?: string
  details: FileDetails
}

export interface RaiderFileDbRow {
  path: string
  is_url: number
  name: string
  highlights: string
  conversation_history: string
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
