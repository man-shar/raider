import { ConversationType, HighlightType, NewMessageDetails, RaiderFile } from '@types'

export interface ChatManager {
  sendChatMessage: (details: NewMessageDetails) => Promise<ConversationType>
  setLoading: (value: boolean) => void
  getLoading: () => boolean
  subscribeToLoading: (callback: Listener) => Listener
  setActiveHighlight: (highlight: HighlightType | null) => void
  getActiveHighlight: () => HighlightType | null
  getActiveFile: () => RaiderFile | null
  subscribeToActiveHighlight: (callback: Listener) => Listener
  alertActiveFileListeners: Listener
  alertActiveHighlightListeners: Listener
}

export function ChatManager(): ChatManager {
  let loading = false
  let conversationListeners: Listener[] = []
  let loadingListeners: Listener[] = []
  let activeFile: RaiderFile | null = null
  let activeHighlight: HighlightType | null = null

  function getActiveHighlight(): HighlightType | null {
    return activeHighlight
  }

  function getActiveFile(): RaiderFile | null {
    return activeFile
  }

  function subscribeToActiveHighlight(callback: Listener): Listener {
    conversationListeners.push(callback)
    return () => {
      conversationListeners = conversationListeners.filter((c) => c !== callback)
    }
  }

  function alertActiveFileListeners() {
    conversationListeners.forEach((listener) => listener())
  }

  function alertActiveHighlightListeners() {
    conversationListeners.forEach((listener) => listener())
  }

  function setActiveHighlight(highlight: HighlightType | null) {
    activeHighlight = highlight

    alertActiveHighlightListeners()
  }

  function setLoading(value: boolean) {
    loading = value
    alertLoadingListeners()
  }

  function getLoading(): boolean {
    return loading
  }

  function alertLoadingListeners() {
    loadingListeners.forEach((listener) => listener())
  }

  function subscribeToLoading(listener: Listener) {
    loadingListeners.push(listener)

    return () => {
      loadingListeners = loadingListeners.filter((l) => l !== listener)
    }
  }

  async function sendChatMessage(details: NewMessageDetails) {
    if (loading) {
      throw new Error('Cancel the last chat message to send a new one.')
    }

    console.log('Sending details', details)
    setLoading(true)
    const conversation = await window.chat.sendChatMessage(details)

    if ('error' in conversation) {
      throw new Error(conversation.error)
    }

    setLoading(false)

    return conversation
  }

  return {
    sendChatMessage,
    getLoading,
    setLoading,
    subscribeToLoading,
    setActiveHighlight,
    getActiveFile,
    getActiveHighlight,
    subscribeToActiveHighlight,
    alertActiveFileListeners,
    alertActiveHighlightListeners
  }
}
