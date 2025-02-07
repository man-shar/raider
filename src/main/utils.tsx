import * as sqliteVec from 'sqlite-vec'
import type { Database as db } from 'better-sqlite3'
import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'

export function getDb(): db {
  // Initialize SQLite database in the user's app data directory
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'raider.db')
  const db = new Database(dbPath)
  sqliteVec.load(db)

  return db
}
