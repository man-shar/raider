import { FileDetails } from '@types'
import { IpcMainInvokeEvent } from 'electron'
import { updateFileDetailsInDb } from '../db/fileUtils'

export function updateFileDetails(
  _event: IpcMainInvokeEvent,
  path: string,
  is_url: number,
  name: string,
  details: FileDetails
) {
  return updateFileDetailsInDb({ path, is_url, name, details })
}
