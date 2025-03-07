import { ChatMessageType, HighlightType, MessageDetails, RaiderFile } from '@types'

export interface ChatManager {
  messages: ChatMessageType[]
  sendChatMessage: (details: MessageDetails) => Promise<void>
  setLoading: (value: boolean) => void
  getMessages: () => ChatMessageType[]
  getLoading: () => boolean
  subscribeToLoading: (callback: Listener) => Listener
  subscribeToChatMessages: (callback: Listener) => Listener
  setActiveFile: (file: RaiderFile | null) => void
  setActiveHighlight: (highlight: HighlightType | null) => void
  getActiveHighlight: () => HighlightType | null
  getActiveFile: () => RaiderFile | null
  subscribeToActiveFile: (callback: Listener) => Listener
  subscribeToActiveHighlight: (callback: Listener) => Listener
  alertActiveFileListeners: Listener
  alertActiveHighlightListeners: Listener
}

export function ChatManager(): ChatManager {
  let messages: ChatMessageType[] = []
  let loading = false
  let chatMessageListeners: Listener[] = []
  let loadingListeners: Listener[] = []
  let activeFile: RaiderFile | null = null
  let activeHighlight: HighlightType | null = null
  let chatSubmitListeners: { [filePath: string]: Listener[] } = {}

  function getActiveHighlight(): HighlightType | null {
    return activeHighlight
  }

  function getActiveFile(): RaiderFile | null {
    return activeFile
  }

  function subscribeToActiveFile(callback: Listener): Listener {
    chatMessageListeners.push(callback)
    return () => {
      chatMessageListeners = chatMessageListeners.filter((c) => c !== callback)
    }
  }

  function subscribeToActiveHighlight(callback: Listener): Listener {
    chatMessageListeners.push(callback)
    return () => {
      chatMessageListeners = chatMessageListeners.filter((c) => c !== callback)
    }
  }

  function alertActiveFileListeners() {
    chatMessageListeners.forEach((listener) => listener())
  }

  function alertActiveHighlightListeners() {
    chatMessageListeners.forEach((listener) => listener())
  }

  function setActiveFile(file: RaiderFile | null) {
    activeFile = file

    alertActiveFileListeners()
  }

  function setActiveHighlight(highlight: HighlightType | null) {
    activeHighlight = highlight

    alertActiveHighlightListeners()
  }

  function subscribeToChatSubmit(filePath: string, callback: Listener) {
    if (!chatSubmitListeners[filePath]) {
      chatSubmitListeners[filePath] = []
    }

    chatSubmitListeners[filePath].push(callback)
    return () => {
      chatSubmitListeners[filePath] = chatSubmitListeners[filePath].filter((l) => l !== callback)
    }
  }

  function alertChatSubmitListeners(filePath: string) {
    chatSubmitListeners[filePath]?.forEach((listener) => listener())
  }

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

  function alertChatMessageListeners() {
    chatMessageListeners.forEach((listener) => listener())
  }

  function alertLoadingListeners() {
    loadingListeners.forEach((listener) => listener())
  }

  function subscribeToChatMessages(listener: Listener) {
    chatMessageListeners.push(listener)

    return () => {
      chatMessageListeners = chatMessageListeners.filter((l) => l !== listener)
    }
  }

  function subscribeToLoading(listener: Listener) {
    loadingListeners.push(listener)

    return () => {
      loadingListeners = loadingListeners.filter((l) => l !== listener)
    }
  }

  async function sendChatMessage(details: MessageDetails) {
    if (loading) {
      throw new Error('Cancel the last chat message to send a new one.')
    }
    setLoading(true)
    const chatMessage = await window.chat.sendChatMessage(details)

    if ('error' in chatMessage) {
      throw new Error(chatMessage.error)
    }

    messages = [...messages, chatMessage]

    setLoading(false)

    alertChatMessageListeners()
  }

  return {
    messages,
    sendChatMessage,
    getMessages,
    getLoading,
    setLoading,
    subscribeToLoading,
    subscribeToChatMessages,
    setActiveFile,
    setActiveHighlight,
    getActiveFile,
    getActiveHighlight,
    subscribeToActiveFile,
    subscribeToActiveHighlight,
    alertActiveFileListeners,
    alertActiveHighlightListeners
  }
}
