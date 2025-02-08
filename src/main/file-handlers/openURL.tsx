import { RaiderFile } from '@types'
import { parseUrl } from '../utils'
import { IpcMainInvokeEvent } from 'electron'

/**
 * Opens Electron's file selection dialog and returns the list of selected files.
 */
export async function openURL(
  _event: IpcMainInvokeEvent,
  url: string
): Promise<RaiderFile | { error: string }> {
  const parsedUrl = parseUrl(url)
  try {
    // download the file and return it
    const res = await fetch(parsedUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/pdf'
      }
    })
    const buf = await res.arrayBuffer()

    console.log(parsedUrl)
    return {
      path: parsedUrl,
      name: parsedUrl.split('/').pop() || parsedUrl,
      metadata: {
        highlights: []
      },
      buf: { data: Array.from(new Uint8Array(buf)) },
      type: 'pdf'
    }
  } catch (e: any) {
    console.error(e)
    return { error: e.message }
  }
}
