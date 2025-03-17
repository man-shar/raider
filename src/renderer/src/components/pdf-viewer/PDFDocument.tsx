import { useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Document, Outline, Page } from 'react-pdf'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { HighlightType } from '@types'
import LinkService from 'react-pdf/src/LinkService.js'
import { ScrollPageIntoViewArgs } from 'react-pdf/src/shared/types.js'
import { IFrame } from '../utils/Iframe'
import { MessageManagerContext } from '@defogdotai/agents-ui-components/core-ui'
import { useKeyDown } from '@renderer/hooks/useKeyDown'
import debounce from 'lodash.debounce'
import { Highlights } from './Highlights'
import KeyboardShortcutIndicator from '../utils/KeyboardShortcutIndicator'
import { createHighlightFromSelection } from '@renderer/utils'
import { useClick } from '@renderer/hooks/useClick'
import { AppContext } from '@renderer/context/AppContext'
import { PDFManager } from './PDFManager'

interface DocumentRef {
  linkService: React.RefObject<LinkService>
  pages: React.RefObject<HTMLDivElement[]>
  viewer: React.RefObject<{
    currentPageNumber?: number
    scrollPageIntoView: (args: ScrollPageIntoViewArgs) => void
  }>
}

export function PDFDocument({
  pdfManager,
  onTextExtracted
}: {
  pdfManager: PDFManager
  onTextExtracted: (fullText: string, pageWiseText: { [pageNumber: number]: string }) => void
}) {
  const [numPages, setNumPages] = useState<number>()
  const pageWiseText = useRef<{ [pageNumber: number]: string }>({})
  const fullText = useRef<string>('')

  const { chatManager } = useContext(AppContext)

  const file = useSyncExternalStore(pdfManager.subscribe, pdfManager.getFile)

  const options = useRef({
    cMapUrl: '/cmaps/',
    standardFontDataUrl: '/standard_fonts/'
  })

  const { statusManager } = useContext(AppContext)

  const onDocumentLoadSuccess = useCallback(
    async (pdf: PDFDocumentProxy) => {
      setNumPages(pdf.numPages)

      if (!file.details.fullText) {
        const start = performance.now()

        const fileName = file.name || 'PDF'

        // Create a parent task for text extraction
        const taskId = statusManager.addTask({
          type: 'pdf_text_extraction',
          label: `Extracting text from ${fileName.length > 40 ? fileName.slice(0, 40) + '...' : fileName}`,
          progress: 0
        })

        statusManager.startTask(taskId)

        for (let i = 1; i <= pdf.numPages; i++) {
          // Update progress as we go
          statusManager.updateTask(taskId, {
            progress: Math.round(((i - 1) / pdf.numPages) * 100)
          })

          // Create subtask for each page
          const pageTaskId = statusManager.addSubtask(taskId, {
            type: 'pdf_page_extraction',
            label: `Extracting page ${i}/${pdf.numPages}`
          })

          if (pageTaskId) {
            statusManager.startTask(pageTaskId)

            try {
              const page = await pdf.getPage(i)
              const textContent = await page.getTextContent()
              // @ts-ignore - The PDF.js typings are sometimes inconsistent
              pageWiseText.current[i] = textContent.items
                .map((item: any) => item.str || '')
                .join('')

              statusManager.completeTask(pageTaskId)
            } catch (error) {
              pageWiseText.current[i] = '\n\n Error extracting page text for page number ' + i
              console.log('Error extracting page text for page number', i)
              statusManager.errorTask(pageTaskId, `Error extracting page ${i}`)
            }
          }
        }

        const end = performance.now()
        console.log('Time taken to extract full text', (end - start) / 1000 + ' seconds')

        fullText.current = Object.values(pageWiseText.current).join('\n')

        statusManager.completeTask(taskId)
        onTextExtracted(fullText.current, pageWiseText.current)
      } else {
        console.log(`Full text for file: ${file.path} already extracted`)
      }
    },
    [file, statusManager]
  )

  const ctrRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const documentRef = useRef<DocumentRef>(null)
  const tocRef = useRef<HTMLDivElement>(null)
  const message = useContext(MessageManagerContext)

  // on text selection on this dom element, console log
  const handleSelectionChange = useCallback(() => {
    // if this event was not triggered from a pdf file, ignore it

    // get selection location on the browser window
    // and log it
    if (!tooltipRef.current || !iframeRef.current || !ctrRef.current) return
    iframeRef.current.style.opacity = '0'
    iframeRef.current.style.pointerEvents = 'none'

    const selection = document.getSelection()

    if (!selection || selection.toString() === '') {
      return
    }

    try {
      // @ts-ignore
      let parent = selection.anchorNode.parentNode
      if (!parent) return
      // @ts-ignore
      const isFromPDFDocument = parent.closest('.pdf-document')
      if (!isFromPDFDocument) return
    } catch (error) {
      return
    }

    const range = selection.getRangeAt(0)
    const clientRects = range.getClientRects()
    const ctrRect = ctrRef.current?.getBoundingClientRect()

    let top = clientRects[0].top - ctrRect?.top - iframeRef.current.offsetHeight - 10
    let left = clientRects[0].left - ctrRef.current?.getBoundingClientRect().left

    // if going outside the window, set it to 5 from the top
    // or 5 from the right
    if (top < 0) {
      const topOfParent = ctrRef.current?.getBoundingClientRect().top
      if (topOfParent + top < 0) {
        top = 5
      } else {
        top = topOfParent + top
      }
    }

    if (left + iframeRef.current?.offsetWidth > ctrRect.width) {
      left = ctrRect.width - 10 - iframeRef.current?.offsetWidth
    }

    // set tooltip position
    iframeRef.current.style.opacity = '1'
    iframeRef.current.style.top = `${top}px`
    iframeRef.current.style.left = `${left}px`
    iframeRef.current.style.pointerEvents = 'auto'
  }, [])

  // detect ctrl enter keypress
  const handleAddHighlightToChatBox = useCallback(() => {
    const selection = document.getSelection()
    if (!selection || selection.toString() === '' || !iframeRef.current) {
      return
    }

    const highlight = createHighlightFromSelection({
      ctrRef: ctrRef.current,
      hasConversation: true
    })

    if (!highlight) {
      console.error('Could not start conversation')
      message.error('Could not start conversation')
      return
    }

    try {
      chatManager.setActiveHighlight(highlight)
    } catch (error) {
      console.error(error || 'Could not start conversation')
    } finally {
      // hide tooltip
      iframeRef.current.style.opacity = '0'
    }
  }, [chatManager])

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
    if (!ctrRef.current) {
      setWidth(500)
    } else {
      setWidth(ctrRef.current?.clientWidth < 500 ? 500 : ctrRef?.current?.clientWidth)
    }
  }, [])

  const createNewHighlight = useCallback(
    async (highlight: HighlightType | null = null) => {
      try {
        let newHighlight: HighlightType | null = highlight

        if (!newHighlight) {
          newHighlight = createHighlightFromSelection({ ctrRef: ctrRef.current })
        } else {
          newHighlight = highlight
        }

        if (!newHighlight) return

        await pdfManager.addOrUpdateHighlight(newHighlight)
      } catch (error) {
        console.error(error || 'Could not create highlight!')
        message.error(error || 'Could not create highlight!')
      } finally {
        if (iframeRef.current) {
          iframeRef.current.style.opacity = '0'
        }
      }
    },
    [ctrRef, file]
  )

  const highlightHovered = useRef<HighlightType | null>(null)

  useKeyDown({ key: 'T', meta: true, callback: toggleToc }, [toggleToc])
  useKeyDown({ key: 'H', meta: true, callback: createNewHighlight }, [createNewHighlight])
  useKeyDown({ key: 'Enter', meta: true, callback: handleAddHighlightToChatBox }, [
    handleAddHighlightToChatBox
  ])

  useKeyDown(
    {
      key: 'r',
      meta: true,
      callback: async () => {
        if (highlightHovered.current && highlightHovered.current.id) {
          try {
            pdfManager.removeHighlight(highlightHovered.current)
          } catch (error) {
            console.error(error || 'Could not delete highlight!')
            message.error(error || 'Could not delete highlight!')
          }
        }
      }
    },
    [file]
  )

  useClick({
    meta: true,
    callback: () => {
      if (highlightHovered.current) {
        chatManager.setActiveHighlight(highlightHovered.current)
      }
    }
  })

  useEffect(() => {
    if (!ctrRef.current) return

    document.addEventListener('selectionchange', handleSelectionChange)
    window.addEventListener('resize', debounce(handleResize, 200))

    handleResize()

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [createNewHighlight, handleResize, handleSelectionChange])

  return (
    <div ref={ctrRef}>
      <IFrame
        ref={iframeRef}
        className="w-60 shadow-md h-20 p-2 rounded-md bg-white border text-xs"
        style={{
          opacity: 0,
          position: 'absolute',
          left: 0,
          zIndex: 1000,
          pointerEvents: 'none'
        }}
      >
        <div ref={tooltipRef} className="tooltip text-xs w-full h-full flex flex-col gap-2">
          <KeyboardShortcutIndicator meta={true} keyValue={'Enter'} text="Start conversation" />
          <KeyboardShortcutIndicator meta={true} keyValue={'H'} text="Create highlight" />
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
          {Array.from(new Array(numPages)).map((_, index) => (
            <Page
              pageIndex={index}
              width={width}
              key={`page_${index + 1}`}
              className="mb-4 raider-pdf-page"
            >
              <Highlights
                onHover={(highlight) => (highlightHovered.current = highlight)}
                highlights={file.highlights.filter(
                  (highlight) => highlight.pageNumber === index + 1
                )}
                width={width}
              />
            </Page>
          ))}
          <div
            className="hidden fixed max-h-96 overflow-auto top-20 left-1/12 mx-auto z-10 px-4 py-2 bg-gray-600 text-gray-200 border border-gray-200 shadow rounded-md text-xs w-10/12"
            ref={tocRef}
          >
            <h1 className="text-gray-200">Table of Contents</h1>
            <Outline
              className=""
              onItemClick={({ dest }) => {
                if (!dest) return

                documentRef.current?.linkService.current.goToDestination(dest)
                toggleToc()
              }}
            ></Outline>
          </div>

          <div className="relative"></div>
        </Document>
      )}
    </div>
  )
}
