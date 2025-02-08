import { FileHighlights, RaiderFile, RaiderFileDbRow } from '@types'
import { getDb } from '../utils'

/**
 * Parse the json columns which come in as strings from the database
 */
function parseFileRowToRaiderFile(row: RaiderFileDbRow): RaiderFile {
  return {
    ...row,
    highlights: JSON.parse(row.highlights),
    chat_history: JSON.parse(row.chat_history)
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

    const insertStmt = db.prepare(`INSERT INTO files (path, is_url, name) VALUES (?, ?, ?)`)
    insertStmt.run(path, is_url, name)

    // also add this file to the list of opened files
    const openFilesTable = db.prepare(
      `INSERT INTO open_files (path, is_url, name) VALUES (?, ?, ?)`
    )
    openFilesTable.run(path, is_url, name)

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
    return { error: error.message }
  } finally {
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
    const result = updateStmt.run(JSON.stringify(highlights), path)

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
 * Gets the highlights of a file. Returns empty array if the file is not found.
 */
