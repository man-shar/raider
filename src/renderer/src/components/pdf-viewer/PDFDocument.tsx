import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Document, Outline, Page } from 'react-pdf'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { HighlightsType, HighlightType, PDFFile } from '@types'
import LinkService from 'react-pdf/src/LinkService.js'
import { ScrollPageIntoViewArgs } from 'react-pdf/src/shared/types.js'
import { Command, CornerDownLeft } from 'lucide-react'
import { IFrame } from '../Iframe'
import { AppContext } from '@renderer/context/AppContext'
import { MessageManagerContext } from '@defogdotai/agents-ui-components/core-ui'
import { useKeyDown } from '@renderer/hooks/useKeyDown'
import debounce from 'lodash.debounce'
import { Highlights } from './Highlights'

interface DocumentRef {
  linkService: React.RefObject<LinkService>
  pages: React.RefObject<HTMLDivElement[]>
  viewer: React.RefObject<{
    scrollPageIntoView: (args: ScrollPageIntoViewArgs) => void
  }>
}

export function PDFDocument({ file }: { file: PDFFile }) {
  const [numPages, setNumPages] = useState<number>()
  const [highlights, setHighlights] = useState<HighlightsType>([])

  const options = useRef({
    cMapUrl: '/cmaps/',
    standardFontDataUrl: '/standard_fonts/'
  })

  const onDocumentLoadSuccess = useCallback(async (pdf: PDFDocumentProxy) => {
    setNumPages(pdf.numPages)
  }, [])

  const ctrRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const documentRef = useRef<DocumentRef>(null)
  const tocRef = useRef<HTMLDivElement>(null)

  const { chatManager } = useContext(AppContext)
  const message = useContext(MessageManagerContext)

  // on text selection on this dom element, console log
  const handleSelectionChange = useCallback(
    (e: MouseEvent) => {
      // if this event was not triggered from a pdf file, ignore it
      try {
        // @ts-ignore
        const isFromPDFDocument = e?.target?.closest('.pdf-document')
        if (!isFromPDFDocument) return
      } catch (error) {
        return
      }

      // get selection location on the browser window
      // and log it
      if (!tooltipRef.current || !iframeRef.current || !ctrRef.current) return
      iframeRef.current.style.opacity = '0'

      const selection = document.getSelection()
      if (!selection || selection.toString() === '') {
        return
      }

      const range = selection.getRangeAt(0)
      const clientRects = range.getClientRects()
      const ctrRect = ctrRef.current?.getBoundingClientRect()

      // set tooltip position
      iframeRef.current.style.opacity = '1'
      iframeRef.current.style.top = `${clientRects[0].top - ctrRect?.top - iframeRef.current.offsetHeight - 10}px`
      iframeRef.current.style.left = `${clientRects[0].left - ctrRect?.left}px`
    },
    [chatManager]
  )

  // detect ctrl enter keypress
  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        const selection = document.getSelection()
        if (
          !selection ||
          selection.toString() === '' ||
          !textAreaRef.current ||
          !textAreaRef.current.value ||
          !iframeRef.current
        ) {
          message.error('Either empty message or no text selected.')
          return
        }

        try {
          // get this text, and send chat message
          chatManager
            .sendChatMessage({
              userInput: textAreaRef.current?.value,
              highlightedText: selection.toString()
            })
            .catch((error) => {
              message.error('Error sending message:' + error)
            })
        } catch (error) {
          message.error('Error sending message:' + error)
        } finally {
          // reset textarea
          textAreaRef.current.value = ''
          // hide tooltip
          iframeRef.current.style.opacity = '0'
        }
      }
    },
    [chatManager]
  )

  const toggleToc = useCallback(() => {
    if (!tocRef.current) return

    if (tocRef.current) {
      if (tocRef.current.classList.contains('hidden')) {
        tocRef.current.classList.remove('hidden')
      } else {
        tocRef.current.classList.add('hidden')
      }
    }
  }, [])

  const [width, setWidth] = useState<number>(500)

  const handleResize = useCallback(() => {
    if (!ctrRef.current) return
    setWidth(ctrRef.current?.clientWidth < 500 ? 500 : ctrRef.current?.clientWidth)
  }, [])

  useKeyDown({ key: 't', ctrl: true, callback: toggleToc })

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'h') {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || !ctrRef.current) return

      // Get all the selected ranges
      const range = selection.getRangeAt(0)
      let chunks: { x: number; y: number; width: number; height: number }[] = []

      const ctrRect = ctrRef.current?.getBoundingClientRect()
      if (!ctrRect) return

      // Get client rects for each line in the selection
      const clientRects = range.getClientRects()

      for (let i = 0; i < clientRects.length; i++) {
        const rect = clientRects[i]
        if (rect.height > 40) continue

        chunks.push({
          x: rect.left - ctrRect.left,
          y: rect.top - ctrRect.top,
          width: rect.width,
          height: rect.height
        })
      }

      // deduplicate chunks
      chunks = chunks.filter((chunk, index) => {
        return chunks.findIndex((c) => c.x === chunk.x && c.y === chunk.y) === index
      })

      const highlight: HighlightType = {
        fullText: selection.toString(),
        comment: '',
        originalViewportWidth: ctrRect.width,
        chunks
      }

      setHighlights((prev) => [...prev, highlight])
    }
  }, [])

  useEffect(() => {
    // then add them back
    document.addEventListener('mouseup', handleSelectionChange)
    iframeRef.current?.contentDocument?.addEventListener('keydown', handleKeyPress)
    window.addEventListener('resize', debounce(handleResize, 100))
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mouseup', handleSelectionChange)
      iframeRef.current?.contentDocument?.removeEventListener('keydown', handleKeyPress)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, handleKeyPress, handleResize, handleSelectionChange])

  return (
    <div ref={ctrRef}>
      <IFrame
        ref={iframeRef}
        className="w-96"
        style={{
          opacity: 0,
          position: 'absolute',
          left: 0,
          height: '82px',
          zIndex: 100
        }}
      >
        <div
          ref={tooltipRef}
          className="tooltip absolute rounded-md overflow-hidden bg-white text-xs shadow border border-lime-300 text-lime-500 z-100 w-full"
          onMouseUp={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
            textAreaRef.current?.focus()
          }}
        >
          <div className="flex flex-col w-full gap-2 p-2 bg-lime-600 text-lime-200 border-lime-100">
            <textarea
              className="w-full h-10 overflow-scroll grow resize-none border-b border-b-lime-500 focus:ring-none focus:outline-none"
              placeholder="Ask a question about this highlight"
              ref={textAreaRef}
            />
            <span className="submit flex flex-row gap-1 pr-2 items-center">
              Ask
              <Command className="w-2 h-2 inline mr-1" />
              <CornerDownLeft className="w-2 h-2 inline" />
            </span>
          </div>
        </div>
      </IFrame>

      <Document
        ref={documentRef}
        file={file.buf}
        onLoadSuccess={onDocumentLoadSuccess}
        options={options.current}
        className="relative pdf-document"
      >
        <div className="hidden sticky h-0 top-20 left-20 right-0 mx-auto z-10" ref={tocRef}>
          <Outline
            className="px-4 py-2 bg-gray-600 text-gray-200 border border-gray-200 shadow rounded-md text-xs w-fit"
            onItemClick={({ pageNumber }) => {
              documentRef.current?.viewer.current.scrollPageIntoView({
                pageNumber: pageNumber
              })
              toggleToc()
            }}
          />
        </div>
        <div className="relative">
          <Highlights highlights={highlights} width={width} />
          {Array.from(new Array(numPages), (_, index) => {
            return (
              <Page
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                className="mb-4"
                width={width}
              />
            )
          })}
        </div>
      </Document>
    </div>
  )
}
