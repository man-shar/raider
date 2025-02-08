import { ipcMain } from 'electron'
import sendChatMessage from '../chat-handlers/sendChatMessage'
import { selectFile } from '../file-handlers/selectFile'
import { openURL } from '../file-handlers/openURL'
import { updateFileHighlights } from '../file-handlers/updateHighlights'

export function setupHandlers() {
  // chat handlers
  ipcMain.handle('chat:send-message', sendChatMessage)

  // file handlers
  ipcMain.handle('file:select', selectFile)
  ipcMain.handle('file:open-url', openURL)
  ipcMain.handle('file:update-highlights', updateFileHighlights)
}
