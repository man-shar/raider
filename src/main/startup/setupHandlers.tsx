import { ipcMain } from 'electron'
import sendChatMessage from '../chat-handlers/sendChatMessage'
import { selectFile } from '../file-handlers/selectFile'
import { openURL } from '../file-handlers/openURL'

export function setupHandlers() {
  ipcMain.handle('chat:send-message', sendChatMessage)

  ipcMain.handle('file:select', selectFile)
  ipcMain.handle('file:open-url', openURL)
}
