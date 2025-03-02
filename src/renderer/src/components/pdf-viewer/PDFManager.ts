import { HighlightType, RaiderFile } from '@types'

type Updater = (oldFile: RaiderFile) => RaiderFile

export interface PDFManager {
  filePath: string
  subscribe: (listener: Listener) => () => void
  updateFile: (newFileOrUpdater: RaiderFile | Updater) => void
  getFile: () => RaiderFile
  addOrUpdateHighlight: (highlight: HighlightType) => Promise<void>
  removeHighlight: (highlight: HighlightType) => Promise<void>
}

export function PDFManager(f: RaiderFile): PDFManager {
  let listeners: Listener[] = []

  let file = f

  function updateFile(newFileOrUpdater: RaiderFile | Updater): void {
    if (typeof newFileOrUpdater === 'function') {
      file = newFileOrUpdater(file)
    } else {
      file = newFileOrUpdater
    }

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

  return {
    get filePath() {
      return file.path
    },
    addOrUpdateHighlight,
    getFile,
    subscribe,
    updateFile,
    removeHighlight
  }
}
