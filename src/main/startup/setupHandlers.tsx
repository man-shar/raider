import { ipcMain } from 'electron'
import sendChatMessage from '../chat-handlers/sendChatMessage'
import { getApiKey, setApiKey, getModel, setModel, getAvailableModels } from '../chat-handlers/openai'
import { selectFile } from '../file-handlers/selectFile'
import { openURL } from '../file-handlers/openURL'
import { updateFileHighlights } from '../file-handlers/updateHighlights'
import { closeFile } from '../file-handlers/closeFile'
import { getOpenFiles } from '../file-handlers/getOpenFiles'
import { updateFileDetails } from '../file-handlers/updateFileDetails'

export function setupHandlers() {
  // chat handlers
  ipcMain.handle('chat:send-message', sendChatMessage)
  
  // API key and model management
  ipcMain.handle('chat:set-api-key', (_event, key) => setApiKey(key))
  ipcMain.handle('chat:get-api-key', () => getApiKey())
  ipcMain.handle('chat:set-model', (_event, model) => setModel(model))
  ipcMain.handle('chat:get-model', () => getModel())
  ipcMain.handle('chat:get-available-models', () => getAvailableModels())

  // file handlers
  ipcMain.handle('file:select', selectFile)
  ipcMain.handle('file:open-url', openURL)
  ipcMain.handle('file:update-highlights', updateFileHighlights)
  ipcMain.handle('file:close', closeFile)
  ipcMain.handle('file:get-last-opened-files', getOpenFiles)
  ipcMain.handle('file:update-details', updateFileDetails)
}
