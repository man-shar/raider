import { RaiderFile } from '@types'
import { dialog, IpcMainInvokeEvent } from 'electron'
import { readFileSync } from 'fs'
import { createOrGetFileFromDb, insertFileDataInDb } from '../db/fileUtils'

/**
 * Reads a file from a path
 */
export async function readFileFromPath(filePath: string): Promise<RaiderFile> {
  const name = filePath.split('/').pop() || filePath

  // try to create a file in the db
  const { error, file } = createOrGetFileFromDb({
    path: filePath,
    name,
    is_url: 0
  })

  if (error || !file) throw new Error(error || 'Could not open file')

  const buf = readFileSync(filePath)

  insertFileDataInDb({
    path: filePath,
    is_url: 0,
    name,
    buf: new Uint8Array(buf)
  })

  return file
}

/**
 * Opens Electron's file selection dialog and returns the list of selected files as RaiderFile objects.
 * If the operation is canceled, returns an empty array.
 * If an error occurs during file reading or database interaction, returns an error message.
 * The function supports selecting multiple PDF files and reads them as array buffers for further processing.
 */
export async function selectFile(
  _event: IpcMainInvokeEvent
): Promise<{ files?: RaiderFile[]; error?: string }> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  try {
    if (canceled) {
      return { files: [] }
    } else {
      // read these files as array buffers, convert them to uint8arrays and send back.
      const files = await Promise.all(
        filePaths.map(async (filePath: string) => {
          return readFileFromPath(filePath)
        })
      )

      return { files }
    }
  } catch (error: any) {
    console.error('Error selecting files:', error)
    return { error: error.message }
  }
}
