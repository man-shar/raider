import { ChatMessageType, MessageDetails } from '@types'

export interface ChatManager {
  messages: ChatMessageType[]
  sendChatMessage: (details: MessageDetails) => Promise<void>
  setLoading: (value: boolean) => void
  getMessages: () => ChatMessageType[]
  getLoading: () => boolean
  subscribeToLoading: (callback: () => void) => () => void
  subscribeToChatMessages: (callback: () => void) => () => void
}

export function ChatManager(): ChatManager {
  let messages: ChatMessageType[] = []
  let loading = false
  let chatMessageListeners: (() => void)[] = []
  let loadingListeners: (() => void)[] = []

  function setLoading(value: boolean) {
    loading = value
    alertLoadingListeners()
  }

  function getLoading(): boolean {
    return loading
  }

  function getMessages(): ChatMessageType[] {
    return messages
  }

  function alertChatListeners() {
    chatMessageListeners.forEach((listener) => listener())
  }

  function alertLoadingListeners() {
    loadingListeners.forEach((listener) => listener())
  }

  function subscribeToChatMessages(callback: () => void) {
    chatMessageListeners.push(callback)

    return () => {
      chatMessageListeners = chatMessageListeners.filter((listener) => listener !== callback)
    }
  }

  function subscribeToLoading(callback: () => void) {
    loadingListeners.push(callback)

    return () => {
      loadingListeners = loadingListeners.filter((listener) => listener !== callback)
    }
  }

  async function sendChatMessage(details: MessageDetails) {
    if (loading) {
      throw new Error('Cancel the last chat message to send a new one.')
    }
    setLoading(true)
    const chatMessage = await window.chat.sendChatMessage(details)

    console.log(chatMessage)
    messages.push(chatMessage)

    setLoading(false)

    alertChatListeners()
  }

  return {
    messages,
    sendChatMessage,
    getMessages,
    getLoading,
    setLoading,
    subscribeToLoading,
    subscribeToChatMessages
  }
}
