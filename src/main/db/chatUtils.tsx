import { ConversationType } from '@types'
import { getDb } from '../utils'

export function addOrUpdateConversationInDb({
  path,
  is_url,
  name,
  conversation
}: {
  path: string
  is_url: number
  name: string
  conversation: ConversationType
}): { error?: string } {
  const db = getDb()
  try {
    const conversationHistoryStmt = db.prepare<
      [string, number, string],
      { conversation_history: string }
    >(`SELECT conversation_history FROM files WHERE path = ? AND is_url = ? AND name = ?`)

    const result = conversationHistoryStmt.get(path, is_url, name)

    if (!result) {
      throw new Error('Chat history not found')
    }

    // Parse the JSON string into an array
    const conversationHistory: ConversationType[] = JSON.parse(result.conversation_history)

    // find the index of the chat to update
    const convIdx = conversationHistory.findIndex((c) => c.id === conversation.id)
    if (convIdx === -1) {
      console.log(`Conversation id: ${conversation.id} not found.. creating new one.`)
      conversationHistory.push(conversation)
    } else {
      console.log(`Conversation id: ${conversation.id} found. Updating.`)
      conversationHistory[convIdx] = conversation
    }

    const updateStmt = db.prepare<[string, string, number, string]>(
      `UPDATE files SET conversation_history = ? WHERE path = ? AND is_url = ? AND name = ?`
    )
    updateStmt.run(JSON.stringify(conversationHistory), path, is_url, name)

    return {}
  } catch (error: any) {
    console.error('Error updating chat:', error)
    return { error: error.message }
  } finally {
    db.close()
  }
}

export function deleteConversationInDb({
  path,
  is_url,
  name,
  conversationId
}: {
  path: string
  is_url: number
  name: string
  conversationId: string
}): { error?: string } {
  const db = getDb()
  try {
    const deleteStmt = db.prepare<[string, number, string, string]>(
      `DELETE FROM files WHERE path = ? AND is_url = ? AND name = ? AND conversation_id = ?`
    )
    deleteStmt.run(path, is_url, name, conversationId)
    return {}
  } catch (error: any) {
    console.error('Error deleting chat:', error)
    return { error: error.message }
  } finally {
    db.close()
  }
}

export function getConversationFromDb({
  path,
  is_url,
  name,
  conversationId
}: {
  path: string
  is_url: number
  name: string
  conversationId: string
}): { conversation?: ConversationType; error?: string } {
  const db = getDb()
  try {
    const stmt = db.prepare<[string, number, string], { conversation_history: string }>(
      `SELECT conversation_history FROM files WHERE path = ? AND is_url = ? AND name = ?`
    )

    const result = stmt.get(path, is_url, name)

    if (!result) {
      throw new Error('Chat history not found')
    }
    const conversationHistory = JSON.parse(result.conversation_history)

    const conversation = conversationHistory.find((c) => c.id === conversationId)

    if (!conversation) {
      throw new Error('Conversation not found')
    }

    return { conversation }
  } catch (error: any) {
    console.error('Error getting chat:', error)
    return { error: error.message }
  } finally {
    db.close()
  }
}
