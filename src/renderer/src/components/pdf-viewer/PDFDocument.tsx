import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import { Document } from 'react-pdf'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { HighlightType } from '@types'
import LinkService from 'react-pdf/src/LinkService.js'
import { ScrollPageIntoViewArgs } from 'react-pdf/src/shared/types.js'
import { IFrame } from '../utils/Iframe'
import { MessageManagerContext } from '@defogdotai/agents-ui-components/core-ui'
import { useKeyDown } from '@renderer/hooks/useKeyDown'
import KeyboardShortcutIndicator from '../utils/KeyboardShortcutIndicator'
import { createHighlightFromSelection, JUMP_BACK_TO_TIMEOUT } from '@renderer/utils'
import { AppContext } from '@renderer/context/AppContext'
import { PDFManager } from './PDFManager'
import { PDFPageVirtualizer } from './PDFPageVirtualizer'
import { BUFFER_SIZE } from '../utils/constants'
import { ToC } from './ToC'

type PDFOutline = Awaited<ReturnType<PDFDocumentProxy['getOutline']>>

// Import custom outline styles
import '@renderer/assets/pdf-outline.css'
import { Undo, Undo2 } from 'lucide-react'

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
  const pageCtrRef = useRef<HTMLDivElement>(null)
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

  const [outline, setOutline] = useState<PDFOutline | null>(null)

  const onDocumentLoadSuccess = useCallback(
    async (pdf: PDFDocumentProxy) => {
      setNumPages(pdf.numPages)
      setOutline(await pdf.getOutline())
      // Initialize refs
      pageRefs.current = Array.from({ length: pdf.numPages }).map(() => null)
      const file = pdfManager.getFile()

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
    [statusManager]
  )

  const [ctrRef, setCtrRef] = useState<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const documentRef = useRef<DocumentRef>(null)
  const message = useContext(MessageManagerContext)

  // on text selection on this dom element, console log
  const handleSelectionChange = useCallback(() => {
    // if this event was not triggered from a pdf file, ignore it

    // get selection location on the browser window
    // and log it
    if (!tooltipRef.current || !iframeRef.current || !ctrRef) return
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
    const ctrRect = ctrRef?.getBoundingClientRect()

    let top = clientRects[0].top - ctrRect?.top - iframeRef.current.offsetHeight - 10
    let left = clientRects[0].left - ctrRef?.getBoundingClientRect().left

    // if going outside the window, set it to 5 from the top
    // or 5 from the right
    if (top < 0) {
      const topOfParent = ctrRef?.getBoundingClientRect().top
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
  }, [ctrRef])

  // detect ctrl enter keypress
  const handleAddHighlightToChatBox = useCallback(() => {
    const selection = document.getSelection()
    if (!selection || selection.toString() === '' || !iframeRef.current) {
      return
    }

    const highlight = createHighlightFromSelection({
      ctrRef: ctrRef,
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

  const [tocVisible, setTocVisible] = useState(false)

  const toggleToc = useCallback((e: any) => {
    e?.preventDefault()
    e?.stopPropagation()

    setTocVisible((prev) => !prev)
  }, [])

  // Using width directly from props

  const createNewHighlight = useCallback(async () => {
    try {
      let newHighlight: HighlightType | null = createHighlightFromSelection({
        ctrRef: ctrRef
      })

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
  }, [ctrRef])

  const highlightHovered = useRef<HighlightType | null>(null)

  useKeyDown({ key: 'T', meta: true, callback: toggleToc }, [])
  useKeyDown({ key: 'H', target: ctrRef, callback: createNewHighlight }, [ctrRef])
  useKeyDown({ key: 'Enter', target: ctrRef, callback: handleAddHighlightToChatBox }, [ctrRef])

  useKeyDown(
    {
      key: 'R',
      meta: true,
      callback: () => {
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
    []
  )

  useEffect(() => {
    if (!ctrRef) return () => {}

    const tocOff = (e) => {
      if (e.target.closest('.toc-btn') || e.target.closest('.toc-ctr')) return

      setTocVisible(false)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    ctrRef.addEventListener('click', tocOff)

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      ctrRef.removeEventListener('click', tocOff)
    }
  }, [ctrRef, handleSelectionChange])

  // Track which pages should have active content
  const [activePages, setActivePages] = useState<number[]>([])
  const scrollContainerRef = useRef<HTMLElement | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const mostVisiblePage = useRef<{ pageNumber: number; intersectionH: number }>({
    pageNumber: null,
    intersectionH: 0
  })

  // Calculate which pages should be active based on scroll position
  const updateActivePages = useCallback(() => {
    if (!scrollContainerRef.current || !ctrRef || !numPages) return

    const scrollContainer = scrollContainerRef.current

    // Find visible pages
    const visiblePages: number[] = []
    // also reset the most visible page
    mostVisiblePage.current = {
      pageNumber: null,
      intersectionH: 0
    }

    for (let i = 0; i < numPages; i++) {
      const pageElement = pageRefs.current[i]
      if (!pageElement) continue

      const rect = pageElement.getBoundingClientRect()
      const containerRect = scrollContainer.getBoundingClientRect()

      // Check if page is in viewport

      // calculate pct inside screen
      const isBottomOfPageBelowCtrTop = rect.bottom > containerRect.top
      const isTopOfPageAboveCtrBottom = rect.top < containerRect.bottom

      const intersectionH =
        Math.min(containerRect.bottom, rect.bottom) - Math.max(containerRect.top, rect.top)

      if (isBottomOfPageBelowCtrTop && isTopOfPageAboveCtrBottom) {
        if (
          !mostVisiblePage.current.pageNumber ||
          mostVisiblePage.current.intersectionH < intersectionH
        ) {
          mostVisiblePage.current.pageNumber = i + 1
          mostVisiblePage.current.intersectionH = intersectionH
        }

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

    setActivePages((prev) => {
      if (!prev || !Array.isArray(prev)) return newActivePages

      if (newActivePages.join(',') === prev.join(',')) return prev

      const currStartPage = prev[0]
      const currEndPage = prev.slice(-1)[0]

      // only update if either minVisiblePage < current start page
      // or maxVisiblePage is > current end page
      if (
        minVisiblePage >= currStartPage &&
        minVisiblePage <= currEndPage &&
        maxVisiblePage >= currStartPage &&
        maxVisiblePage <= currEndPage
      )
        return prev

      return newActivePages
    })

    // also update the scroll position as a percentage from top, so we can always stay at the exact right place
    if (pageCtrRef.current) {
      const pageCtrRect = pageCtrRef.current.getBoundingClientRect()
      localStorage.setItem(
        file.path + '--scrollPos',
        '' + Math.abs(pageCtrRect.top) / Math.abs(pageCtrRect.height)
      )
    }
    localStorage.setItem(file.path + '--activePages', JSON.stringify(newActivePages))
  }, [numPages])

  // Initialize scrolling and page visibility detection
  useEffect(() => {
    if (!ctrRef || !numPages) return () => {}

    // Find scroll container
    const scrollContainer = ctrRef.closest('.view-ctr') as HTMLElement
    if (!scrollContainer) return () => {}

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

    // Initialize active pages
    // Start with first few pages active
    let initialActivePages, initTimer, initialPos

    // After a delay, perform the first real calculation
    initTimer = setTimeout(() => {
      setIsInitializing(false)

      try {
        initialActivePages = JSON.parse(localStorage.getItem(file.path + '--activePages'))
        initialPos = +localStorage.getItem(file.path + '--scrollPos')

        if (!initialActivePages.length) throw new Error()

        setActivePages(initialActivePages)

        // scroll to the actual page
        const targetPage = initialActivePages[Math.floor(initialActivePages.length / 2)]

        // scroll document to the page ref
        const pageRef = pageRefs.current[targetPage]
        if (pageRef) {
          pageRef.scrollIntoView({
            behavior: 'instant',
            block: 'start'
          })
        }
      } catch (e) {
        console.error(e)

        updateActivePages()
      }
    }, 500)

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll)
      clearTimeout(initTimer)
    }
  }, [ctrRef, numPages, updateActivePages, width])

  const { current: annos } = useRef<{ [pageNumber: number]: { [id: string]: any } }>({})

  const fileBuf = useMemo(() => {
    if (!file.buf) return null
    return { data: new Uint8Array(file.buf) }
  }, [file.buf])

  const [jumpBackTo, setJumpBackTo] = useState<{ pageNumber: number; timeout: NodeJS.Timeout }>(
    null
  )

  return (
    <div ref={(e) => setCtrRef(e)} className="w-full relative" tabIndex={0}>
      {outline && (
        <button
          className="toc-btn z-5 sticky top-[50vh] left-[20px] h-0"
          onClick={toggleToc}
          title="Toggle Table of Contents (⌘T)"
        >
          <div className="h-fit space-y-2 rounded-md p-2 shadow border border-gray-300 cursor-pointer gap-2 bg-white hover:bg-gray-50 group">
            <div className="w-2 h-2 border-b border-gray-500"></div>
            <div className="w-2 h-2 border-b border-gray-500"></div>
            <div className="w-2 h-2 border-b border-gray-500"></div>
            <div className="w-2 h-2 border-b border-gray-500"></div>
            <div className="w-2 h-2 border-b border-gray-500"></div>
            <div className="w-2 h-2 border-b border-gray-500"></div>
          </div>
        </button>
      )}

      {outline && documentRef?.current?.linkService?.current && (
        <ToC
          // @ts-ignore
          outline={outline}
          linkService={documentRef.current.linkService.current}
          hidden={!tocVisible}
        />
      )}

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
          <KeyboardShortcutIndicator keyValue={'Enter'} text="Start conversation" />
          <KeyboardShortcutIndicator keyValue={'H'} text="Create highlight" />
        </div>
      </IFrame>

      {jumpBackTo && jumpBackTo.pageNumber && (
        <div
          className="sticky text-sm text-gray-500 cursor-pointer hover:bg-gray-100 top-20 w-fit m-auto z-4 bg-white border-1 border-b-2 select-none border-gray-400 shadow-md rounded-full p-1 px-2 flex flex-row items-center gap-2"
          onClick={() => {
            // scroll document to the page ref
            const pageRef = pageRefs.current[jumpBackTo.pageNumber - 1]

            if (pageRef) {
              pageRef.scrollIntoView({
                behavior: 'instant',
                block: 'start'
              })
              // set to null after clicking
              setJumpBackTo({
                pageNumber: null,
                timeout: null
              })
            }
          }}
        >
          Back to page {jumpBackTo.pageNumber} <Undo2 className="w-4 h-4 " />
        </div>
      )}

      {ctrRef && fileBuf && (
        <Document
          ref={documentRef}
          file={fileBuf}
          onLoadSuccess={onDocumentLoadSuccess}
          options={options.current}
          className="relative pdf-document"
          onItemClick={async ({ dest, pageNumber }) => {
            // note that this is different from the PdfPageVirtualizer's onMouseDown event handlers attached to each page
            // this handles left-mouse-button clicks on outline items/links to things within the pdf
            // the internal one does slightly more subtle/specific things like opening links and opening a peek preview
            // if middle mouse button is pressed

            // scroll document to the page ref
            const pageRef = pageRefs.current[pageNumber - 1]
            if (pageRef) {
              setJumpBackTo((prev) => {
                // clear old timeout jic exists
                clearTimeout(prev && prev?.timeout)

                const p = mostVisiblePage.current.pageNumber

                // do this *after* storing the page above to prevent getting target page value
                pageRef.scrollIntoView({
                  behavior: 'instant',
                  block: 'start'
                })

                return {
                  pageNumber: p,
                  // after a certain timeout, hide the jumpback to button
                  timeout: setTimeout(() => {
                    setJumpBackTo({ pageNumber: null, timeout: null })
                  }, JUMP_BACK_TO_TIMEOUT)
                }
              })
            }
          }}
        >
          {numPages && (
            <PDFPageVirtualizer
              ctrRef={pageCtrRef}
              annos={annos}
              numPages={numPages}
              width={width}
              highlights={file.highlights}
              onHover={(highlight) => (highlightHovered.current = highlight)}
              activePages={activePages}
              isInitializing={isInitializing}
              setPageRef={setPageRef}
            />
          )}

          <div className="relative"></div>
        </Document>
      )}
    </div>
  )
}
