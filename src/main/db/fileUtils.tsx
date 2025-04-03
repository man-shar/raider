import {
  FileDetails,
  HighlightType,
  RaiderFile,
  RaiderFileDataDbRow,
  RaiderFileDbRow
} from '@types'
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
    conversation_history: JSON.parse(row.conversation_history),
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
  details: FileDetails
}): { error?: string; updatedDetails?: FileDetails } {
  const db = getDb()
  try {
    const updateStmt = db.prepare(
      `UPDATE files SET details = ? WHERE path = ? AND is_url = ? AND name = ?`
    )
    updateStmt.run(JSON.stringify(details), path, is_url, name)
    return { updatedDetails: details }
  } catch (error: any) {
    console.error('Error updating file details:', error)
    return { error: error.message }
  } finally {
    db.close()
  }
}

/**
 * Inserts a row in the files table with the given file.
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

    const insertStmt = db.prepare<[string, number, string], null>(
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
  highlights: HighlightType[]
}): { error?: string; newHighlights?: HighlightType[] } {
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
export async function getOpenFilesFromDb(): Promise<{
  error?: string
  files?: RaiderFile[]
}> {
  const db = getDb()
  try {
    const rows = db
      .prepare<[], RaiderFileDbRow>(
        `
        SELECT f.* 
        FROM files f
        JOIN open_files of ON f.path = of.path AND f.is_url = of.is_url
      `
      )
      .all()

    const parsedFiles = rows.map((file) => parseFileRowToRaiderFile(file))

    return { files: parsedFiles }
  } catch (error: any) {
    console.error('Error getting last opened files:', error)
    return { error: error.message }
  } finally {
    db.close()
  }
}

export async function insertFileDataInDb({
  path,
  name,
  is_url,
  buf
}: {
  path: string
  name: string
  is_url: number
  buf: Uint8Array
}): Promise<{ error?: string }> {
  const db = getDb()

  try {
    const insertStmt = db.prepare<[string, number, string, Buffer], null>(
      `INSERT OR IGNORE INTO file_data (path, is_url, name, buf) VALUES (?, ?, ?, ?)`
    )

    insertStmt.run(path, is_url, name, Buffer.from(buf))

    return {}
  } catch (error) {
    console.error('Error inserting file data', error)
    return { error: error.message }
  } finally {
    db.close()
  }
}

export async function getFileDataFromDb({
  path,
  name,
  is_url
}: {
  path: string
  name: string
  is_url: number
}): Promise<{ error?: string; buf?: Uint8Array }> {
  const db = getDb()

  try {
    console.time('Get file data from db')
    const exists = db
      .prepare<
        [string, number, string],
        RaiderFileDataDbRow
      >(`SELECT * FROM file_data WHERE path = ? AND is_url = ? AND name = ?`)
      .get(path, is_url, name)

    if (!exists) {
      throw new Error('File not found')
    }
    console.timeEnd('Get file data from db')

    console.time('Parse file data')
    return { buf: new Uint8Array(exists.buf) }
  } catch (error) {
    console.error('Error getting file data', error)
    return { error: error.message }
  } finally {
    console.timeEnd('Parse file data')
    db.close()
  }
}
