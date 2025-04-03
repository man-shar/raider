import { RaiderFile } from '@types'
import { parseUrl } from '../utils'
import { IpcMainInvokeEvent } from 'electron'
import { createOrGetFileFromDb, insertFileDataInDb } from '../db/fileUtils'

/**
 * Reads a file from a URL.
 */
export async function readFileFromUrl(url: string): Promise<RaiderFile> {
  const parsedUrl = parseUrl(url)
  const filePath = parsedUrl
  const name = parsedUrl.split('/').pop() || parsedUrl

  // download the file and return it
  const res = await fetch(parsedUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/pdf'
    }
  })
  const buf = new Uint8Array(await res.arrayBuffer())

  // try to create a file in the db
  const { error, file } = createOrGetFileFromDb({
    path: filePath,
    name,
    is_url: 1
  })

  if (error || !file) throw new Error(error || 'Could not open file')

  insertFileDataInDb({
    path: filePath,
    is_url: 1,
    name,
    buf: buf
  })

  return file
}

/**
 *
 */
export async function openURL(
  _event: IpcMainInvokeEvent,
  url: string
): Promise<{ file?: RaiderFile; error?: string }> {
  try {
    return { file: await readFileFromUrl(url) }
  } catch (e: any) {
    console.error(e)
    return { error: e.message }
  }
}
