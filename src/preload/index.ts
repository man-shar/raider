import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { ChatAPI, ChatMessage } from '../types'

// Custom APIs for renderer
const chat: ChatAPI = {
  // Add chat-related methods
  sendChatMessage: (message: string): Promise<ChatMessage> =>
    ipcRenderer.invoke('chat:send-message', message)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('chat', chat)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.chat = chat
}
