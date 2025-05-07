import { Page, useDocumentContext } from 'react-pdf'
import { Highlights } from './Highlights'
import { HighlightType } from '@types'
import { BUFFER_SIZE } from '../utils/constants'
import { Ref, useEffect, useState } from 'react'
import { MOUSE_BUTTON } from '@renderer/utils'
import { useKeyDown } from '@renderer/hooks/useKeyDown'

interface PDFPageVirtualizerProps {
  numPages: number
  width: number
  highlights: HighlightType[]
  onHover: (highlight: HighlightType | null) => void
  activePages: number[]
  isInitializing: boolean
  ctrRef: Ref<HTMLDivElement>
  setPageRef: (index: number) => (el: HTMLDivElement | null) => void
  annos: { [pageNumber: number]: { [id: string]: any } }
  /**
   * If this is inside a "peeking window", isChild is true. Helpful flag to prevent creating peeking windows recursively.
   */
  isChild?: boolean
}

export function PDFPageVirtualizer({
  annos,
  numPages,
  width,
  highlights,
  onHover,
  activePages,
  isInitializing,
  ctrRef,
  setPageRef,
  isChild = false
}: PDFPageVirtualizerProps) {
  useEffect(() => {
    Array.from({ length: numPages }).map((_, index) => {
      annos[index + 1] = {}
    })
  }, [])

  const { pdf } = useDocumentContext()

  const [peekingState, setPeekingState] = useState<{
    /** Tje page number at which we want to *show* the peek window */
    sourcePageNumber: number
    /** The page number that we want to show *inside* the peek window (initially) */
    targetPageNumber: number
    anno: any
    location: { bottom: number }
  }>(null)

  useKeyDown(
    {
      key: 'Escape',
      callback: (e) => {
        console.log(e.target)
        if (!e.target.closest('.view-ctr')) return

        setPeekingState(null)
      }
    },
    []
  )

  return (
    <div className="pdf-virtualized-pages" ref={ctrRef}>
      {Array.from({ length: numPages }).map((_, index) => {
        const isActive = isInitializing
          ? index < BUFFER_SIZE // First few pages during initialization
          : activePages.includes(index)

        return (
          <div
            key={`page_${index}`}
            ref={setPageRef(index)}
            className="pdf-page-container mb-4 flex justify-center relative"
            data-page-index={index}
          >
            {isActive ? (
              <Page
                // renderMode="canvas"
                pageIndex={index}
                width={width}
                className="raider-pdf-page relative"
                renderTextLayer={true}
                renderAnnotationLayer={true}
                onMouseDown={async (e: MouseEvent) => {
                  if (!e) return

                  // e.preventDefault()
                  // e.stopPropagation()
                  const isMiddleMouseButton = e.button === MOUSE_BUTTON.MIDDLE

                  if (e.target instanceof HTMLAnchorElement) {
                    const annoId = e.target.id.split('_').slice(-1)[0]
                    const anno = annos[index + 1][annoId]
                    if (!anno) return

                    if (anno.url) {
                      window.open(anno.url, '_blank')
                    }

                    if (isMiddleMouseButton) {
                      if (!pdf || isChild) return

                      const parentCtr = e.target.closest('.raider-pdf-page')

                      if (!parentCtr) return

                      // if clicked on the same anno, close peek window if open
                      if (peekingState && anno === peekingState?.anno) {
                        setPeekingState(null)
                        return
                      }

                      try {
                        const parentRect = parentCtr.getBoundingClientRect()
                        const targetRect = e.target.getBoundingClientRect()
                        const pageIdx = await pdf.getPageIndex(anno.dest[0])
                        const targetPageNumber = pageIdx + 1

                        // open up a mini "window" above the click to peek at the target page
                        // is 100% a feature stolen from the GOATs over at Sioyek
                        console.log(
                          `Clicked to go to ${targetPageNumber} from page number: ${index + 1}`
                        )
                        console.log('middle button pressed!!!')

                        setPeekingState({
                          sourcePageNumber: index + 1,
                          targetPageNumber: targetPageNumber,
                          anno: anno,
                          location: {
                            bottom: parentRect.bottom - targetRect.bottom + 50
                          }
                        })
                      } catch (e) {
                        console.error('Could not get page number from anno:')
                        console.error(e)
                        console.error(anno)
                      }
                    }
                  } else {
                    if (isMiddleMouseButton) {
                      // close the peek if we didn't click on the anno
                      setPeekingState(null)
                    }
                  }
                }}
                onGetAnnotationsSuccess={(annotations) => {
                  annotations.forEach((anno) => {
                    annos[index + 1][anno.id] = anno
                  })
                }}
              >
                <Highlights
                  onHover={onHover}
                  highlights={highlights.filter((highlight) => highlight.pageNumber === index + 1)}
                  width={width}
                />
                {peekingState && peekingState.sourcePageNumber === index + 1 ? (
                  <div
                    className="peek-window absolute w-[99%] bg-white h-20 border border-red-500 rounded-sm left-1/2 -translate-x-1/2 mx-auto"
                    style={{
                      bottom: peekingState.location.bottom + 'px'
                    }}
                  >
                    Was clicked here {index + 1}
                  </div>
                ) : null}
              </Page>
            ) : (
              <div
                className="pdf-page-placeholder flex items-center justify-center"
                style={{
                  width: `${width}px`,
                  minWidth: `${width}px`, // Ensure minimum width
                  aspectRatio: '0.7071', // A4 aspect ratio (1/√2)
                  backgroundColor: '#f9f9f9',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px'
                }}
              >
                <span className="text-gray-400">Page {index + 1}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
