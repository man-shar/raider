import { ElectronAPI } from '@electron-toolkit/preload'

export interface PDFFile {
  file: File
  buf: ArrayBuffer
  metadata: { name: string }
}

export interface ChatMessage {
  prompt: string
  timestamp: string
  response: string
  metadata: {
    model_name: string
  }
}

export interface Chat {
  messages: ChatMessage[]
}

export interface ChatAPI {
  sendChatMessage: (message: string) => Promise<ChatMessage>
}

declare global {
  interface Window {
    electron: ElectronAPI
    chat: ChatAPI
  }
}
