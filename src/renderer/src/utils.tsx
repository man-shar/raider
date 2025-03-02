import { HighlightType } from '@types'

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  var binary = ''
  var bytes = new Uint8Array(buffer)
  var len = bytes.byteLength
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

export function createHighlightFromSelection({
  ctrRef,
  hasConversation = false
}: {
  ctrRef: HTMLElement | null | undefined
  hasConversation?: boolean
}): HighlightType | null {
  const selection = window.getSelection()
  let pageNumber: number
  let pageDom: HTMLElement | null | undefined

  try {
    // also get pdf page
    pageDom = selection?.anchorNode?.parentElement?.closest('.raider-pdf-page')
    if (!pageDom) throw new Error('Page dom not found')
    // get the data attribute data-page-number of the page
    pageNumber = Number(pageDom?.getAttribute('data-page-number'))
    if (!pageNumber) throw new Error('Page number not found')
  } catch (error) {
    console.log('error getting page number of highlight', error)
    return null
  }

  if (!selection || selection.isCollapsed || !ctrRef || !pageNumber || !pageDom) return null

  // Get all the selected ranges
  const range = selection.getRangeAt(0)
  let chunks: { x: number; y: number; width: number; height: number }[] = []

  const pageDomRect = pageDom?.getBoundingClientRect()
  if (!pageDomRect) return null

  // Get client rects for each line in the selection
  const clientRects = range.getClientRects()

  for (let i = 0; i < clientRects.length; i++) {
    const rect = clientRects[i]
    if (rect.height > 40) continue

    chunks.push({
      x: rect.left - pageDomRect.left,
      y: rect.top - pageDomRect.top,
      width: rect.width,
      height: rect.height
    })
  }

  // deduplicate chunks
  chunks = chunks.filter((chunk, index) => {
    return chunks.findIndex((c) => c.x === chunk.x && c.y === chunk.y) === index
  })

  const highlight: HighlightType = {
    id: crypto.randomUUID(),
    fullText: selection.toString(),
    has_conversation: hasConversation,
    comment: '',
    originalViewportWidth: pageDomRect.width,
    pageNumber: pageNumber,
    chunks
  }

  return highlight
}
