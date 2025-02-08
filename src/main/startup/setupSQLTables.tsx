import { getDb } from '../utils'

export function createSqlTables() {
  const db = getDb()

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // create a table to store files that have been opened
  // and a json column that stores the highlights
  // a json column that stores chat history for this particular file
  console.log('Creating files table')
  const filesTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      is_url BOOLEAN NOT NULL,
      name TEXT NOT NULL,
      highlights JSON NOT NULL DEFAULT '[]',
      chat_history JSON NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // a table to store the opened files in a session
  // which will be restored when the app is reopened
  const openFilesTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS open_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      is_url BOOLEAN NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  filesTable.run()
  openFilesTable.run()

  // Close the database connection
  db.close()
}
