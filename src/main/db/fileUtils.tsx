import { FileHighlights, RaiderFile, RaiderFileDbRow } from '@types'
import { getDb } from '../utils'
import { readFileFromPath } from '../file-handlers/selectFile'
import { readFileFromUrl } from '../file-handlers/openURL'

/**
 * Parse the json columns which come in as strings from the database
 */
function parseFileRowToRaiderFile(row: RaiderFileDbRow): RaiderFile {
  return {
    ...row,
    highlights: JSON.parse(row.highlights),
    chat_history: JSON.parse(row.chat_history),
    details: JSON.parse(row.details)
  }
}

/** Updates the details of a file in the database */
export function updateFileDetailsInDb({
  path,
  is_url,
  name,
  details
}: {
  path: string
  is_url: number
  name: string
  details: { [key: string]: any }
}): { error?: string } {
  const db = getDb()
  try {
    const updateStmt = db.prepare(
      `UPDATE files SET details = ? WHERE path = ? AND is_url = ? AND name = ?`
    )
    updateStmt.run(JSON.stringify(details), path, is_url, name)
    return {}
  } catch (error: any) {
    console.error('Error updating file details:', error)
    return { error: error.message }
  } finally {
    db.close()
  }
}

/** Inserts a row in the files table with the given file.
 * If file already exists, returns the details of the file.
 */
export function createOrGetFileFromDb({
  path,
  is_url,
  name
}: {
  path: string
  is_url: number
  name: string
}): { error?: string; file?: RaiderFile } {
  const db = getDb()
  let err = null
  try {
    // check if the file already exists in the table
    // if it does, don't do anything
    const exists = db.prepare(`SELECT * FROM files WHERE path = ?`).get(path)
    if (exists) {
      // get the  details of the file
      const file = db
        .prepare<string, RaiderFileDbRow>(`SELECT * FROM files WHERE path = ?`)
        .get(path)

      if (!file) throw new Error('File was found in db but could not be retrieved.')

      return { file: parseFileRowToRaiderFile(file) }
    }

    const insertStmt = db.prepare(
      `INSERT OR IGNORE INTO files (path, is_url, name) VALUES (?, ?, ?)`
    )
    insertStmt.run(path, is_url, name)

    // get the inserted row
    const insertedRow = db
      .prepare<string, RaiderFileDbRow>(`SELECT * FROM files WHERE path = ?`)
      .get(path)

    if (!insertedRow) throw new Error('File was inserted but could not be retrieved.')

    return {
      file: parseFileRowToRaiderFile(insertedRow)
    }
  } catch (error: any) {
    console.error('Error creating file:', error)
    err = error
    return { error: error.message }
  } finally {
    if (!err) {
      console.log(path, is_url, name)
      console.log('inserting into open_files table')
      // if there was no error, also add this file to the list of opened files
      const openFilesTable = db.prepare(
        `INSERT OR IGNORE INTO open_files (path, is_url, name) VALUES (?, ?, ?)`
      )
      openFilesTable.run(path, is_url, name)
    }
    db.close()
  }
}

/**
 * Updates the highlights of a file
 */
export function updateFileHighlightsInDb({
  path,
  highlights
}: {
  path: string
  highlights: FileHighlights
}): { error?: string; newHighlights?: FileHighlights } {
  const db = getDb()
  try {
    // if the file doesn't exist, throw an error
    const file = db.prepare<string, RaiderFileDbRow>(`SELECT * FROM files WHERE path = ?`).get(path)
    if (!file) {
      throw new Error('File does not exist')
    }

    const updateStmt = db.prepare(`UPDATE files SET highlights = ? WHERE path = ?`)
    updateStmt.run(JSON.stringify(highlights), path)

    // return the new highlights
    const updatedFile = db
      .prepare<string, RaiderFileDbRow>(`SELECT * FROM files WHERE path = ?`)
      .get(path)
    if (!updatedFile) {
      throw new Error('File does not exist')
    }

    return { newHighlights: JSON.parse(updatedFile.highlights) }
  } catch (error: any) {
    console.error('Error updating file highlights:', error)
    return { error: error.message }
  } finally {
    db.close()
  }
}

/**
 * Removes a file from the list of open files from the db
 */
export function closeFileInDb(path: string): { error?: string } {
  const db = getDb()
  try {
    const deleteStmt = db.prepare(`DELETE FROM open_files WHERE path = ?`)
    deleteStmt.run(path)
    return {}
  } catch (error: any) {
    console.error('Error closing file:', error)
    return { error: error.message }
  } finally {
    db.close()
  }
}

/**
 * Get the last opened files
 */
export async function getOpenFilesFromDb(): Promise<{ error?: string; files?: RaiderFile[] }> {
  const db = getDb()
  try {
    const openedFiles = db
      .prepare<[], { path: string; is_url: number }>(`SELECT path, is_url FROM open_files`)
      .all()
    // get information of all these files from the files table
    let files: RaiderFile[] = []

    for (const openedFile of openedFiles) {
      const isUrl = openedFile.is_url === 1

      try {
        const file = isUrl
          ? await readFileFromUrl(openedFile.path)
          : await readFileFromPath(openedFile.path)

        files.push(file)
      } catch (error: any) {
        console.error('Error reading file:', error)
        // remove this file from the open files table
        closeFileInDb(openedFile.path)
      }
    }

    return { files }
  } catch (error: any) {
    console.error('Error getting last opened files:', error)
    return { error: error.message }
  } finally {
    db.close()
  }
}
