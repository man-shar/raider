import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Document, Outline, Page } from 'react-pdf'
import type { PageViewport, PDFDocumentProxy } from 'pdfjs-dist'
import { FileHighlights, HighlightType, RaiderFile } from '@types'
import LinkService from 'react-pdf/src/LinkService.js'
import { ScrollPageIntoViewArgs } from 'react-pdf/src/shared/types.js'
import { Command, CornerDownLeft } from 'lucide-react'
import { IFrame } from '../Iframe'
import { AppContext } from '@renderer/context/AppContext'
import { MessageManagerContext } from '@defogdotai/agents-ui-components/core-ui'
import { useKeyDown } from '@renderer/hooks/useKeyDown'
import debounce from 'lodash.debounce'
import { Highlights } from './Highlights'
import { VariableSizeList as List } from 'react-window'
import { asyncMap } from '@wojtekmaj/async-array-utils'

interface DocumentRef {
  linkService: React.RefObject<LinkService>
  pages: React.RefObject<HTMLDivElement[]>
  viewer: React.RefObject<{
    scrollPageIntoView: (args: ScrollPageIntoViewArgs) => void
  }>
}

export function PDFDocument({ file }: { file: RaiderFile }) {
  const [numPages, setNumPages] = useState<number>()
  const [highlights, setHighlights] = useState<FileHighlights>(file.highlights || [])
  const [pageViewports, setPageViewports] = useState<{ [pageNumber: number]: PageViewport } | null>(
    null
  )

  const options = useRef({
    cMapUrl: '/cmaps/',
    standardFontDataUrl: '/standard_fonts/'
  })
  const onDocumentLoadSuccess = useCallback(async (pdf: PDFDocumentProxy) => {
    setNumPages(pdf.numPages)
    setPageViewports(null)
    ;(async () => {
      const pageNumbers = Array.from(new Array(pdf.numPages)).map((_, index) => index + 1)

      const nextPageViewports = await asyncMap(pageNumbers, (pageNumber: number) =>
        pdf.getPage(pageNumber).then((page) => page.getViewport({ scale: 1 }))
      )

      setPageViewports(nextPageViewports)
    })()
  }, [])

  function getPageHeight(pageIndex) {
    if (!pageViewports) {
      throw new Error('getPageHeight() called too early')
    }

    const pageViewport = pageViewports[pageIndex]
    const scale = width / pageViewport.width
    const actualHeight = pageViewport.height * scale

    return actualHeight
  }

  const [ctrRef, setCtrRef] = useState<HTMLDivElement | null>(null)
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
      if (!tooltipRef.current || !iframeRef.current || !ctrRef) return
      iframeRef.current.style.opacity = '0'

      const selection = document.getSelection()
      if (!selection || selection.toString() === '') {
        return
      }

      const range = selection.getRangeAt(0)
      const clientRects = range.getClientRects()
      const ctrRect = ctrRef?.getBoundingClientRect()

      // set tooltip position
      iframeRef.current.style.opacity = '1'
      iframeRef.current.style.top = `${clientRects[0].top - ctrRect?.top - iframeRef.current.offsetHeight - 10}px`
      iframeRef.current.style.left = `${clientRects[0].left - ctrRect?.left}px`
    },
    [chatManager]
  )

  // detect ctrl enter keypress
  const handleChatSend = useCallback(
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
    if (!ctrRef) {
      setWidth(500)
    } else {
      setWidth(ctrRef?.clientWidth < 500 ? 500 : ctrRef?.clientWidth)
    }
  }, [ctrRef])

  useKeyDown({ key: 't', ctrl: true, callback: toggleToc })

  const handleHighlight = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'h') {
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
          console.log('error getting page number of highlight', error, e)
          return
        }

        if (!selection || selection.isCollapsed || !ctrRef || !pageNumber || !pageDom) return

        // Get all the selected ranges
        const range = selection.getRangeAt(0)
        let chunks: { x: number; y: number; width: number; height: number }[] = []

        const pageDomRect = pageDom?.getBoundingClientRect()
        if (!pageDomRect) return

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
          fullText: selection.toString(),
          comment: '',
          originalViewportWidth: pageDomRect.width,
          pageNumber: pageNumber,
          chunks
        }

        setHighlights((prev) => [...prev, highlight])
      }
    },
    [ctrRef]
  )

  useEffect(() => {
    if (!ctrRef) return
    // then add them back
    document.addEventListener('mouseup', handleSelectionChange)
    iframeRef.current?.contentDocument?.addEventListener('keydown', handleChatSend)
    window.addEventListener('resize', debounce(handleResize, 200))
    window.addEventListener('keydown', handleHighlight)

    handleResize()

    return () => {
      document.removeEventListener('mouseup', handleSelectionChange)
      iframeRef.current?.contentDocument?.removeEventListener('keydown', handleChatSend)
      window.removeEventListener('keydown', handleHighlight)
    }
  }, [ctrRef, handleHighlight, handleChatSend, handleResize, handleSelectionChange])

  // when the highlights change, send the new ones to the backend
  useEffect(() => {
    window.fileHandler.updateHighlights(file.path, highlights)
  }, [highlights])

  function Row({ index, style }) {
    const thisPageHighlights = highlights.filter((highlight) => highlight.pageNumber === index + 1)

    return (
      <div style={style}>
        <Page
          pageIndex={index}
          width={width}
          key={`page_${index + 1}`}
          className="mb-4 raider-pdf-page"
        >
          <Highlights highlights={thisPageHighlights} width={width} />
        </Page>
      </div>
    )
  }

  return (
    <div
      ref={(e) => {
        setCtrRef(e)
      }}
    >
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

      {ctrRef && (
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
            {pageViewports && numPages && (
              <List
                width={width}
                height={width * 1.5}
                itemCount={numPages}
                itemSize={getPageHeight}
              >
                {Row}
              </List>
            )}
          </div>
        </Document>
      )}
    </div>
  )
}
