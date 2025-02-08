import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { ChatAPI, ChatMessageType, FileAPI, FileHighlights, MessageDetails } from '../types'

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

const fileHandler: FileAPI = {
  selectFile: () => ipcRenderer.invoke('file:select'),
  openURL: (url: string) => ipcRenderer.invoke('file:open-url', url),
  updateHighlights: (path: string, highlights: FileHighlights) =>
    ipcRenderer.invoke('file:update-highlights', path, highlights),
  closeFile: (path: string) => ipcRenderer.invoke('file:close', path),
  getOpenFiles: () => ipcRenderer.invoke('file:get-last-opened-files')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('chat', chat)
    contextBridge.exposeInMainWorld('fileHandler', fileHandler)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.chat = chat
  window.fileHandler = fileHandler
}
