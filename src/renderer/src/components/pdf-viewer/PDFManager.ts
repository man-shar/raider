import { ConversationType, HighlightType, RaiderFile } from '@types'

type Updater = (oldFile: RaiderFile) => RaiderFile

export interface PDFManager {
  filePath: string
  subscribe: (listener: Listener) => () => void
  updateFile: (newFileOrUpdater: RaiderFile | Updater) => void
  getFile: () => RaiderFile
  addOrUpdateHighlight: (highlight: HighlightType) => Promise<void>
  addOrUpdateConversationInHistory: (conversation: ConversationType) => Promise<void>
  removeConversationFromHistory: (conversation: ConversationType) => Promise<void>
  removeHighlight: (highlight: HighlightType) => Promise<void>
}

export function PDFManager(initialState: RaiderFile): PDFManager {
  let listeners: Listener[] = []

  // @ts-ignore
  let file: RaiderFile = initialState
  let ready: boolean = false
  let errored: string | boolean = false

  // init and fetch this file
  async function init() {
    try {
      console.time('Getting file data')
      const { error, buf } = await window.fileHandler.getFileData(
        initialState.path,
        initialState.is_url,
        initialState.name
      )

      console.timeEnd('Getting file data')
      if (error) {
        ready = false
        errored = error
      } else {
        ready = true
        errored = false

        updateFile({
          ...file,
          buf: buf
        })
      }
    } catch (e) {
      console.error(e)
      ready = false
      errored = e.message
    }
  }

  function checkReady() {
    if (!ready && !errored) {
      throw new Error('PDF Managet still fetching')
    } else if (!ready && errored) {
      throw new Error('PDF Manager could not fetch file data')
    }
  }

  function updateFile(newFileOrUpdater: RaiderFile | Updater): void {
    checkReady()

    if (typeof newFileOrUpdater === 'function') {
      file = newFileOrUpdater(file)
    } else {
      file = newFileOrUpdater
    }

    console.log(file)

    alertListeners()
  }

  function getFile() {
    return file
  }

  function alertListeners() {
    listeners.forEach((listener) => listener())
  }

  function subscribe(listener: Listener) {
    listeners.push(listener)

    return () => {
      listeners = listeners.filter((l) => l !== listener)
    }
  }

  async function addOrUpdateHighlight(highlight: HighlightType) {
    checkReady()

    if (!highlight) return

    const idx = file.highlights.findIndex((h) => h.id === highlight.id)

    const newHighlights = [...file.highlights]

    if (idx === -1) {
      // if this highlight doesn't exist in the file, add to the end
      newHighlights.push(highlight)
    } else {
      // if this highlight does exist in the file, update it
      newHighlights[idx] = highlight
    }

    const res = await window.fileHandler.updateHighlights(file.path, newHighlights)

    if (res.error || !res.newHighlights) {
      throw new Error(res.error || 'Could not create highlight!')
    } else if (res.newHighlights) {
      updateFile({
        ...file,
        highlights: res.newHighlights
      })
    }
  }

  async function removeHighlight(highlight: HighlightType) {
    checkReady()

    const { error, newHighlights } = await window.fileHandler.updateHighlights(file.path, [
      ...file.highlights.filter((h) => h.id !== highlight.id)
    ])

    if (error || !newHighlights) {
      throw new Error(error || 'Could not delete highlight!')
    } else if (newHighlights) {
      updateFile({
        ...file,
        highlights: newHighlights
      })
    }
  }

  async function addOrUpdateConversationInHistory(conversation: ConversationType) {
    checkReady()

    const idx = file.conversation_history.findIndex((c) => c.id === conversation.id)

    const newConversations = [...file.conversation_history]

    if (idx === -1) {
      // if this conversation doesn't exist in the file, add to the end
      newConversations.push(conversation)
    } else {
      // if this conversation does exist in the file, update it
      newConversations[idx] = conversation
    }

    updateFile({
      ...file,
      conversation_history: newConversations
    })
  }

  async function removeConversationFromHistory(conversation: ConversationType) {
    checkReady()

    const idx = file.conversation_history.findIndex((c) => c.id === conversation.id)

    if (idx === -1) return

    const newConversations = file.conversation_history.slice()

    newConversations.splice(idx, 1)

    const res = await window.fileHandler.removeConversation(
      file.path,
      file.is_url,
      file.name,
      conversation.id
    )

    if (res.error) {
      throw new Error(res.error)
    }

    updateFile({
      ...file,
      conversation_history: newConversations
    })
  }

  init()

  return {
    get filePath() {
      return file.path
    },
    addOrUpdateHighlight,
    getFile,
    subscribe,
    updateFile,
    addOrUpdateConversationInHistory,
    removeConversationFromHistory,
    removeHighlight
  }
}
