import { Page } from 'react-pdf'
import { Highlights } from './Highlights'
import { HighlightType } from '@types'
import { BUFFER_SIZE } from '../utils/constants'

interface PDFPageVirtualizerProps {
  numPages: number
  width: number
  highlights: HighlightType[]
  onHover: (highlight: HighlightType | null) => void
  activePages: number[]
  isInitializing: boolean
  setPageRef: (index: number) => (el: HTMLDivElement | null) => void
}

export function PDFPageVirtualizer({
  numPages,
  width,
  highlights,
  onHover,
  activePages,
  isInitializing,
  setPageRef
}: PDFPageVirtualizerProps) {
  return (
    <div className="pdf-virtualized-pages">
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
                pageIndex={index}
                width={width}
                className="raider-pdf-page"
                renderTextLayer={true}
                renderAnnotationLayer={true}
              >
                <Highlights
                  onHover={onHover}
                  highlights={highlights.filter((highlight) => highlight.pageNumber === index + 1)}
                  width={width}
                />
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
