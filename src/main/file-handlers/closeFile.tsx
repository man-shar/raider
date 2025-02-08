import { IpcMainInvokeEvent } from 'electron'
import { closeFileInDb } from '../db/fileUtils'

/**
 * Removes a file from the list of open files from the db
 */
export function closeFile(_event: IpcMainInvokeEvent, path: string) {
  return closeFileInDb(path)
}
