import { RaiderFile } from '@types'
import { getOpenFilesFromDb } from '../db/fileUtils'

// get the opened files from the db
export async function getOpenFiles(): Promise<RaiderFile[]> {
  const { files, error } = await getOpenFilesFromDb()

  if (error) {
    return []
  }

  return files || []
}
