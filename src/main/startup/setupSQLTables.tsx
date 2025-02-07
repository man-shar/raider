import { getDb } from '../utils'

export function createSqlTables() {
  const db = getDb()

  // Enable foreign keys
  db.pragma('foreign_keys = ON')

  // Create documents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Create document chunks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding BLOB NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );
  `)

  // Create a vector index on the embeddings column
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vss USING vss0(
      embedding(1536),
      document_id UNINDEXED,
      chunk_text UNINDEXED
    );
  `)

  // Create a trigger to automatically update the vector index when chunks are inserted
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON document_chunks BEGIN
      INSERT INTO chunks_vss(rowid, embedding, document_id, chunk_text)
      VALUES (new.id, new.embedding, new.document_id, new.chunk_text);
    END;
  `)

  // Create a trigger to automatically update the vector index when chunks are deleted
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON document_chunks BEGIN
      DELETE FROM chunks_vss WHERE rowid = old.id;
    END;
  `)

  // Close the database connection
  db.close()
}
