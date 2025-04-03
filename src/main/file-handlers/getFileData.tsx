import { IpcMainInvokeEvent } from 'electron'
import { getFileDataFromDb } from '../db/fileUtils'

/**
 * Gets a file from the db
 */
export function getFileData(
  _event: IpcMainInvokeEvent,
  path: string,
  is_url: number,
  name: string
) {
  return getFileDataFromDb({ path, is_url, name })
}
