import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  ChatAPI,
  ConversationType,
  FileAPI,
  FileDetails,
  HighlightType,
  NewMessageDetails
} from '../types'

// Custom APIs for renderer
const chat: ChatAPI = {
  // Add chat-related methods
  sendChatMessage: (details: NewMessageDetails): Promise<ConversationType> => {
    return ipcRenderer.invoke('chat:send-message', details)
  },

  onChunkReceived: (conversationId: string, callback: (chunk: string) => void) => {
    const eventTargetRef = ipcRenderer.on(conversationId, (_event, value) => callback(value))

    return () => {
      eventTargetRef.removeAllListeners(conversationId)
    }
  },

  // Provider and model management
  getProviders: () => ipcRenderer.invoke('chat:get-providers'),
  updateProviderSettings: (providerId, settings) =>
    ipcRenderer.invoke('chat:update-provider-settings', providerId, settings),
  getActiveProvider: () => ipcRenderer.invoke('chat:get-active-provider'),
  setActiveProvider: (providerId) => ipcRenderer.invoke('chat:set-active-provider', providerId),
  getAvailableModels: (providerId) => ipcRenderer.invoke('chat:get-available-models', providerId)
}

const fileHandler: FileAPI = {
  selectFile: () => ipcRenderer.invoke('file:select'),
  openURL: (url: string) => ipcRenderer.invoke('file:open-url', url),
  updateHighlights: (path: string, highlights: HighlightType[]) =>
    ipcRenderer.invoke('file:update-highlights', path, highlights),
  closeFile: (path: string) => ipcRenderer.invoke('file:close', path),
  getOpenFiles: () => ipcRenderer.invoke('file:get-last-opened-files'),
  removeConversation: (path: string, is_url: number, name: string, conversationId: string) =>
    ipcRenderer.invoke('file:delete-conversation', path, is_url, name, conversationId),
  getFileData: (path: string, is_url: number, name: string) =>
    ipcRenderer.invoke('file:get-file-data', path, is_url, name),
  updateFileDetails: (path: string, is_url: number, name: string, details: FileDetails) =>
    ipcRenderer.invoke('file:update-details', path, is_url, name, details)
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
