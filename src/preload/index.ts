import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { ChatAPI, ChatMessageType, MessageDetails } from '../types'

// Custom APIs for renderer
const chat: ChatAPI = {
  // Add chat-related methods
  sendChatMessage: (details: MessageDetails): Promise<ChatMessageType> => {
    return ipcRenderer.invoke('chat:send-message', details)
  },

  onChunkReceived: (messageId: string, callback: (chunk: string) => void) => {
    const eventTargetRef = ipcRenderer.on(messageId, (_event, value) => callback(value))

    return () => {
      eventTargetRef.removeAllListeners(messageId)
    }
  }
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
