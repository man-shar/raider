import { useCallback, useEffect, useRef, useState } from 'react'
import { Document, Page } from 'react-pdf'

import type { PDFDocumentProxy } from 'pdfjs-dist'
import { PDFFile } from '@types'
import LinkService from 'react-pdf/src/LinkService.js'
import { ScrollPageIntoViewArgs } from 'react-pdf/src/shared/types.js'
import { Command, CornerDownLeft } from 'lucide-react'
import { createPortal } from 'react-dom'
import { IFrame } from './Iframe'

const options = {
  cMapUrl: '/cmaps/',
  standardFontDataUrl: '/standard_fonts/'
}

interface DocumentRef {
  linkService: React.RefObject<LinkService>
  pages: React.RefObject<HTMLDivElement[]>
  viewer: React.RefObject<{
    scrollPageIntoView: (args: ScrollPageIntoViewArgs) => void
  }>
}

export function PDFViewer({ file }: { file: PDFFile }) {
  const [numPages, setNumPages] = useState<number>()

  const onDocumentLoadSuccess = useCallback((pdf: PDFDocumentProxy) => {
    setNumPages(pdf.numPages)
  }, [])

  const ctrRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const documentRef = useRef<DocumentRef>(null)

  useEffect(() => {
    // on text selection on this dom element, console log
    const handleSelectionChange = (e) => {
      // get selection location on the browser window
      // and log it
      if (!tooltipRef.current || !iframeRef.current || !ctrRef.current) return

      const selection = document.getSelection()
      if (!selection || selection.toString() === '') {
        tooltipRef.current.style.opacity = '0'
        return
      }

      const range = selection.getRangeAt(0)
      const clientRects = range.getClientRects()

      // set tooltip position
      iframeRef.current.style.top = `${clientRects[0].top - iframeRef.current.offsetHeight - 10}px`

      console.log(range, clientRects[0])

      tooltipRef.current.style.left = `${(clientRects[0].left * 100) / ctrRef.current?.offsetWidth}%`
      tooltipRef.current.style.opacity = '1'
    }

    document.addEventListener('mouseup', handleSelectionChange)

    // detect ctrl enter keypress
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        const selection = document.getSelection()

        console.log('Ctrl+Enter pressed', selection?.toString())
        if (!selection || selection.toString() === '') {
          return
        }

        // get this text, and send chat message
        window.chat.sendChatMessage(selection.toString())
      }
    }
    document.addEventListener('keydown', handleKeyPress)

    return () => {
      document.removeEventListener('mouseup', handleSelectionChange)
      document.removeEventListener('keydown', handleKeyPress)
    }
  }, [])

  return (
    <div ref={ctrRef}>
      <IFrame
        ref={iframeRef}
        style={{
          opacity: 0,
          position: 'absolute',
          left: 0,
          width: '100%',
          height: '82px',
          zIndex: 100
        }}
      >
        <div
          ref={tooltipRef}
          className="tooltip absolute rounded-md overflow-hidden bg-white text-xs shadow border border-lime-300 text-lime-500 z-100 w-96"
          onMouseUp={(e) => {
            e.stopPropagation()
            e.preventDefault()
            console.log('mouse up')
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
            console.log('mouse down')
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
        file={file.file}
        onLoadSuccess={onDocumentLoadSuccess}
        options={options}
        className="pdf-document"
        renderMode="canvas"
      >
        {Array.from(new Array(numPages), (_, index) => (
          <Page key={`page_${index + 1}`} pageNumber={index + 1} className="mb-4" />
        ))}
      </Document>
    </div>
  )
}
