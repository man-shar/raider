import { ConversationType, HighlightType } from '@types'
import katex from 'katex'

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

export function isLastMessageAssistant(conversation: ConversationType): boolean {
  if (!conversation.messages || !conversation.messages.length) return false

  if (conversation.messages.slice(-1)[0].role !== 'assistant') return false

  return true
}

export function parseTextWithMath(expr: string) {
  try {
    // Latex is wrapped in <latex-block>...</latex-block> for block equations or <latex-inline>...</latex-inline> for inline expressions

    const regexes = [
      /<latex-block>([\s\S]*?)<\/latex-block>/g, // Block LaTeX
      /<latex-inline>([\s\S]*?)<\/latex-inline>/g // Inline LaTeX
    ]

    let matches: RegExpExecArray[] = []

    if (!expr) return null

    for (let i = 0; i < regexes.length; i++) {
      const regex = regexes[i]

      let match: RegExpExecArray | null
      do {
        match = regex.exec(expr)
        if (!match) continue
        matches.push(match)
      } while (match)
    }

    if (matches && matches.length > 0) {
      // console.groupCollapsed('Latex Matches')
      // console.log(expr)
      // console.log(matches.map((d) => d.index))

      // Sort matches by their index to ensure proper order of processing
      matches.sort((a, b) => a.index - b.index)

      // console.log('matches', matches)

      const parsed: string[] = []

      // First, add the content before the first match
      if (matches[0].index > 0) {
        // @ts-ignore
        parsed.push(expr.slice(0, matches[0].index))
      }

      // Process each match in order
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i]

        // Parse the LaTeX content
        // Check if this is a block or inline LaTeX based on the tag
        const isBlockLatex = match[0].includes('<latex-block>')

        // Get the content between this match and the next match (or end of string)
        const nextIndex = i < matches.length - 1 ? matches[i + 1].index : expr.length
        const textBetween = expr.slice(match.index + match[0].length, nextIndex)

        // if this was block latex, add it as a separate entry in the parsed array
        // otherwise, append it to the previous entry in the parsed array to maintain the same sentence when parsing via
        // marked later.
        // if the parsed array is empty, create the first entry
        if (isBlockLatex) {
          parsed.push(
            katex.renderToString(match[1], {
              displayMode: true,
              output: 'html'
            })
          )

          if (textBetween.length > 0) {
            parsed.push(textBetween)
          }
        } else {
          const rendered = katex.renderToString(match[1], {
            displayMode: false,
            output: 'html'
          })
          if (parsed.length > 0) {
            parsed[parsed.length - 1] += rendered + textBetween
          } else {
            parsed.push(rendered + textBetween)
          }
        }
      }

      console.groupEnd()
      // Join all the parsed fragments and replace newline sequences
      return parsed.join('')
    }

    return expr
  } catch (e) {
    console.error(e)
    return expr
  } finally {
  }
}

export const MOUSE_BUTTON = {
  NONE: 0,
  LEFT: 1,
  MIDDLE: 2,
  Right: 3
}

/** Timer after which jump back to button disappears. Set at 30 secs */
export const JUMP_BACK_TO_TIMEOUT = 30000
