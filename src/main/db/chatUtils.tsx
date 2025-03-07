import { ChatMessageType } from '@types'
import { getDb } from '../utils'

export function updateChatHistoryInDb({
  path,
  is_url,
  name,
  chat_history
}: {
  path: string
  is_url: number
  name: string
  chat_history: ChatMessageType[]
}): { error?: string } {
  const db = getDb()
  try {
    const updateStmt = db.prepare<[string, string, number, string]>(
      `UPDATE files SET chat_history = ? WHERE path = ? AND is_url = ? AND name = ?`
    )
    updateStmt.run(JSON.stringify(chat_history), path, is_url, name)
    return {}
  } catch (error: any) {
    console.error('Error updating chat history:', error)
    return { error: error.message }
  } finally {
    db.close()
  }
}

export function updateChatInDb({
  path,
  is_url,
  name,
  chat
}: {
  path: string
  is_url: number
  name: string
  chat: ChatMessageType
}): { error?: string } {
  const db = getDb()
  try {
    const chatHistoryStmt = db.prepare<[string, number, string], ChatMessageType[]>(
      `SELECT chat_history FROM files WHERE path = ? AND is_url = ? AND name = ?`
    )

    const chatHistory = chatHistoryStmt.get(path, is_url, name)

    if (!chatHistory) {
      throw new Error('Chat history not found')
    }
    // find the index of the chat to update
    const chatIndex = chatHistory.findIndex((c) => c.id === chat.id)
    if (chatIndex === -1) {
      throw new Error('Chat not found')
    }

    chatHistory[chatIndex] = chat
    const updateStmt = db.prepare<[string, string, number, string]>(
      `UPDATE files SET chat_history = ? WHERE path = ? AND is_url = ? AND name = ?`
    )
    updateStmt.run(JSON.stringify(chatHistory), path, is_url, name)

    return {}
  } catch (error: any) {
    console.error('Error updating chat:', error)
    return { error: error.message }
  } finally {
    db.close()
  }
}

export function addChatToHistoryInDb({
  path,
  is_url,
  name,
  chat
}: {
  path: string
  is_url: number
  name: string
  chat: ChatMessageType
}): { error?: string } {
  const db = getDb()
  try {
    const chatHistoryStmt = db.prepare<[string, number, string], ChatMessageType[]>(
      `SELECT chat_history FROM files WHERE path = ? AND is_url = ? AND name = ?`
    )

    const chatHistory = chatHistoryStmt.get(path, is_url, name)

    if (!chatHistory) {
      throw new Error('Chat history not found')
    }
    const newChatHistory = [...chatHistory, chat]
    const updateStmt = db.prepare(
      `UPDATE files SET chat_history = ? WHERE path = ? AND is_url = ? AND name = ?`
    )
    updateStmt.run(JSON.stringify(newChatHistory), path, is_url, name)
    return {}
  } catch (error: any) {
    console.error('Error adding chat to history:', error)
    return { error: error.message }
  } finally {
    db.close()
  }
}
