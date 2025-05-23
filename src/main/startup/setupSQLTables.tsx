import { getDb } from '../utils'

export function createSqlTables() {
  const db = getDb()

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // create a table to store files that have been opened
  // and a json column that stores the highlights
  // a json column that stores chat history for this particular file
  console.log('Creating files table')
  // first drop the table if it exists
  // db.prepare(
  //   `
  //   DROP TABLE IF EXISTS files;
  // `
  // ).run()
  // db.prepare(
  //   `
  //   DROP TABLE IF EXISTS open_files;
  // `
  // ).run()
  // db.prepare(
  //   `
  //   DROP TABLE IF EXISTS file_data;
  // `
  // ).run()

  const fileDataTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS file_data (
      path TEXT NOT NULL,
      is_url BOOLEAN NOT NULL,
      name TEXT NOT NULL,
      buf BLOB NOT NULL
    )
  `)

  const filesTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      is_url BOOLEAN NOT NULL,
      name TEXT NOT NULL,
      highlights JSON NOT NULL DEFAULT '[]',
      conversation_history JSON NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      details JSON NOT NULL DEFAULT '{}'
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

  // a table to store provider settings including API keys and model selection
  const providersTable = db.prepare(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      settings JSON NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  fileDataTable.run()
  filesTable.run()
  openFilesTable.run()
  providersTable.run()

  // Close the database connection
  db.close()
}
