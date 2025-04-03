import { ipcMain } from 'electron'
import sendChatMessage from '../chat-handlers/sendChatMessage'
import {
  getProviders,
  getActiveProvider,
  setActiveProvider,
  updateProviderSettings,
  getAvailableModels
} from '../chat-handlers/providerHandlers'
import { selectFile } from '../file-handlers/selectFile'
import { openURL } from '../file-handlers/openURL'
import { updateFileHighlights } from '../file-handlers/updateHighlights'
import { closeFile } from '../file-handlers/closeFile'
import { getOpenFiles } from '../file-handlers/getOpenFiles'
import { updateFileDetails } from '../file-handlers/updateFileDetails'
import { createSqlTables } from './setupSQLTables'
import { providerRegistry } from '../chat-handlers/providers/ProviderRegistry'
import { removeConversation } from '../file-handlers/conversation'
import { getFileData } from '../file-handlers/getFileData'

export function setupHandlers() {
  // Create database tables if they don't exist
  createSqlTables()

  // Initialize provider registry (this will load settings from DB)
  providerRegistry.getAllProviders() // Trigger initialization

  // chat handlers
  ipcMain.handle('chat:send-message', sendChatMessage)

  // Provider and model management
  ipcMain.handle('chat:get-providers', getProviders)
  ipcMain.handle('chat:get-active-provider', getActiveProvider)
  ipcMain.handle('chat:set-active-provider', setActiveProvider)
  ipcMain.handle('chat:update-provider-settings', updateProviderSettings)
  ipcMain.handle('chat:get-available-models', getAvailableModels)

  // file handlers
  ipcMain.handle('file:select', selectFile)
  ipcMain.handle('file:open-url', openURL)
  ipcMain.handle('file:update-highlights', updateFileHighlights)
  ipcMain.handle('file:close', closeFile)
  ipcMain.handle('file:get-last-opened-files', getOpenFiles)
  ipcMain.handle('file:update-details', updateFileDetails)
  ipcMain.handle('file:delete-conversation', removeConversation)
  ipcMain.handle('file:get-file-data', getFileData)
}
