import { HighlightType } from '@types'
import { IpcMainInvokeEvent } from 'electron'
import { updateFileHighlightsInDb } from '../db/fileUtils'

export function updateFileHighlights(
  _event: IpcMainInvokeEvent,
  path: string,
  highlights: HighlightType[]
) {
  return updateFileHighlightsInDb({ path, highlights })
}
