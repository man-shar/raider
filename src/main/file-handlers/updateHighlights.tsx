import { FileHighlights } from '@types'
import { IpcMainInvokeEvent } from 'electron'
import { updateFileHighlightsInDb } from '../db/fileUtils'

export function updateFileHighlights(
  _event: IpcMainInvokeEvent,
  path: string,
  highlights: FileHighlights
) {
  return updateFileHighlightsInDb({ path, highlights })
}
