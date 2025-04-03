import { FileDetails } from '@types'
import { IpcMainInvokeEvent } from 'electron'
import { updateFileDetailsInDb } from '../db/fileUtils'
import { tokenizer } from '../constants'

export function updateFileDetails(
  _event: IpcMainInvokeEvent,
  path: string,
  is_url: number,
  name: string,
  details: FileDetails
) {
  // tokenize the file and save the token length
  if (details.fullText) {
    const start = performance.now()
    details.fileTokenLength = tokenizer.encode(details.fullText).length
    console.log(`Encoding took: ${(performance.now() - start) / 1000}ms`)
  }

  return updateFileDetailsInDb({ path, is_url, name, details })
}
