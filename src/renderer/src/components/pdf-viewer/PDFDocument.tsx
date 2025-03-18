import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import { Document, Outline } from 'react-pdf'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { HighlightType } from '@types'
import LinkService from 'react-pdf/src/LinkService.js'
import { ScrollPageIntoViewArgs } from 'react-pdf/src/shared/types.js'
import { IFrame } from '../utils/Iframe'
import { Collapse, MessageManagerContext } from '@defogdotai/agents-ui-components/core-ui'
import { useKeyDown } from '@renderer/hooks/useKeyDown'
import debounce from 'lodash.debounce'
import KeyboardShortcutIndicator from '../utils/KeyboardShortcutIndicator'
import { createHighlightFromSelection } from '@renderer/utils'
import { useClick } from '@renderer/hooks/useClick'
import { AppContext } from '@renderer/context/AppContext'
import { PDFManager } from './PDFManager'
import { PDFPageVirtualizer } from './PDFPageVirtualizer'
import { BUFFER_SIZE } from '../utils/constants'

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
  onTextExtracted,
  width = 500 // Accept width as a prop with default value
}: {
  pdfManager: PDFManager
  onTextExtracted: (fullText: string, pageWiseText: { [pageNumber: number]: string }) => void
  width?: number
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

  // Store refs to all page wrappers to access their positions
  const pageRefs = useRef<(HTMLDivElement | null)[]>(Array(numPages || 0).fill(null))

  // Set page ref
  const setPageRef = (index: number) => (el: HTMLDivElement | null) => {
    pageRefs.current[index] = el
  }

  const { statusManager } = useContext(AppContext)

  const onDocumentLoadSuccess = useCallback(
    async (pdf: PDFDocumentProxy) => {
      setNumPages(pdf.numPages)
      // Initialize refs
      pageRefs.current = Array.from({ length: pdf.numPages }).map(() => null)

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

  // Using width directly from props

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

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [createNewHighlight, handleSelectionChange])

  // Track which pages should have active content
  const [activePages, setActivePages] = useState<number[]>([])
  const scrollContainerRef = useRef<HTMLElement | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  // Calculate which pages should be active based on scroll position
  const updateActivePages = useCallback(() => {
    if (!scrollContainerRef.current || !ctrRef.current || !numPages) return

    const scrollContainer = scrollContainerRef.current

    // Find visible pages
    const visiblePages: number[] = []

    for (let i = 0; i < numPages; i++) {
      const pageElement = pageRefs.current[i]
      if (!pageElement) continue

      const rect = pageElement.getBoundingClientRect()
      const containerRect = scrollContainer.getBoundingClientRect()

      // Check if page is in viewport
      if (rect.bottom > containerRect.top && rect.top < containerRect.bottom) {
        visiblePages.push(i)
      }
    }

    if (visiblePages.length === 0) {
      // If no pages are visible (rare case), don't change anything
      return
    }

    // Find range of pages to render (visible pages + buffer)
    const minVisiblePage = Math.min(...visiblePages)
    const maxVisiblePage = Math.max(...visiblePages)

    const startPage = Math.max(0, minVisiblePage - BUFFER_SIZE)
    const endPage = Math.min(numPages - 1, maxVisiblePage + BUFFER_SIZE)

    // Create array of page indices to render
    const newActivePages: number[] = []
    for (let i = startPage; i <= endPage; i++) {
      newActivePages.push(i)
    }

    setActivePages(newActivePages)
  }, [numPages])

  // Initialize scrolling and page visibility detection
  useEffect(() => {
    if (!ctrRef.current || !numPages) return

    // Find scroll container
    const scrollContainer = ctrRef.current.closest('.view-ctr') as HTMLElement
    if (!scrollContainer) return

    scrollContainerRef.current = scrollContainer

    // Handle scroll events with throttling via requestAnimationFrame
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateActivePages()
          ticking = false
        })
        ticking = true
      }
    }

    // Add event listeners
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })

    // Initialize active pages
    // Start with first few pages active
    const initialActivePages = Array.from({ length: Math.min(5, numPages) }, (_, i) => i)
    setActivePages(initialActivePages)

    // After a delay, perform the first real calculation
    const initTimer = setTimeout(() => {
      setIsInitializing(false)
      updateActivePages()
    }, 500)

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
      clearTimeout(initTimer)
    }
  }, [ctrRef, numPages, updateActivePages])

  return (
    <div ref={ctrRef} className="w-full">
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
          onClick={(e) => {
            // if this is a link, open in browser
            if (e.target instanceof HTMLAnchorElement) {
              e.preventDefault()
              window.open(e.target.href, '_blank')
            }
          }}
          onItemClick={async ({ pageNumber }) => {
            // scroll document to the page ref
            const pageRef = pageRefs.current[pageNumber - 1]
            if (pageRef) {
              pageRef.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
              })
            }
          }}
        >
          {numPages && (
            <PDFPageVirtualizer
              numPages={numPages}
              width={width}
              highlights={file.highlights}
              onHover={(highlight) => (highlightHovered.current = highlight)}
              activePages={activePages}
              isInitializing={isInitializing}
              setPageRef={setPageRef}
            />
          )}
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
