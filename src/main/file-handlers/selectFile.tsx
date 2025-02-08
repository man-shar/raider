import { RaiderFile } from '@types'
import { dialog, IpcMainInvokeEvent } from 'electron'
import { readFileSync } from 'fs'

/**
 * Opens Electron's file selection dialog and returns the list of selected files.
 */
export async function selectFile(_event: IpcMainInvokeEvent): Promise<RaiderFile[]> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (canceled) return []
  else {
    // read these files as array buffers, convert them to uint8arrays and send back.
    const files = await Promise.all(
      filePaths.map(async (filePath: string) => {
        const buf = readFileSync(filePath)
        return {
          path: filePath,
          name: filePath.split('/').pop() || filePath,
          metadata: {
            highlights: []
          },
          buf: { data: Array.from(new Uint8Array(buf)) },
          type: 'pdf'
        }
      })
    )

    return files
  }
}
