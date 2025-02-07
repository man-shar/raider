import { encoding_for_model } from 'tiktoken'
import type { Tiktoken } from 'tiktoken'
import { ENCODING_MODEL } from '../constants'
import { getDb } from '../utils'
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey: import.meta.env.MAIN_VITE_OPENAI_API_KEY // This is the default and can be omitted
})

export interface Document {
  id: string
  text: string
  created_at?: string
}

export interface DocumentChunk {
  id?: number
  document_id: string
  chunk_text: string
  embedding: Buffer
  created_at?: string
  distance?: number
}

export async function vectorize(text: string): Promise<{ id: string; chunks: DocumentChunk[] }> {
  let enc: Tiktoken | null = null
  try {
    enc = encoding_for_model(ENCODING_MODEL)
    const tokens = enc.encode(text)
    const textDecoder = new TextDecoder()

    const id = crypto.randomUUID()
    // give an id to this document
    const document: Document = {
      id,
      text
    }

    // break the tokens into chunks of 1000 tokens each
    const chunks: { tokens: Uint32Array[]; text: string }[] = []
    for (let i = 0; i < tokens.length; i += 1000) {
      chunks.push({
        // @ts-ignore
        tokens: tokens.slice(i, i + 1000),
        text: textDecoder.decode(tokens.slice(i, i + 1000))
      })
    }

    // Get embeddings for each chunk
    const response = await client.embeddings.create({
      model: ENCODING_MODEL,
      // @ts-ignore
      input: chunks.map((chunk) => chunk.tokens)
    })

    // Create document chunks with embeddings
    const documentChunks: DocumentChunk[] = response.data.map((d, index) => ({
      document_id: id,
      chunk_text: chunks[index].text,
      embedding: Buffer.from(new Float32Array(d.embedding).buffer)
    }))

    storeDocument(document, documentChunks)

    return {
      id,
      chunks: documentChunks
    }
  } catch (error) {
    console.error('Error initializing tiktoken:', error)
    throw error
  } finally {
    if (enc) {
      enc.free()
    }
  }
}

export function storeDocument(document: Document, chunks: DocumentChunk[]) {
  const db = getDb()

  try {
    db.transaction(() => {
      // Store the document
      db.prepare('INSERT INTO documents (id, text) VALUES (?, ?)').run(document.id, document.text)

      // Store each chunk
      const insertChunk = db.prepare(
        'INSERT INTO document_chunks (document_id, chunk_text, embedding) VALUES (?, ?, ?)'
      )

      for (const chunk of chunks) {
        insertChunk.run(chunk.document_id, chunk.chunk_text, chunk.embedding)
      }
    })()

    return true
  } catch (error) {
    console.error('Error storing document:', error)
    return false
  } finally {
    db.close()
  }
}

export function findSimilarChunks(embedding: Buffer, limit: number = 5): DocumentChunk[] {
  const db = getDb()

  try {
    const results = db
      .prepare(
        `
        SELECT 
          dc.*,
          vss.distance
        FROM document_chunks dc
        INNER JOIN chunks_vss_search(?) vss ON dc.id = vss.rowid
        ORDER BY vss.distance ASC
        LIMIT ?
        `
      )
      .all(embedding, limit)

    //@ts-ignore
    return results
  } catch (error) {
    console.error('Error finding similar chunks:', error)
    return []
  } finally {
    db.close()
  }
}
