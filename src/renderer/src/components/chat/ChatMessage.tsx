import { SpinningLoader } from '@defogdotai/agents-ui-components/core-ui'
import { ChatMessageType } from '@types'
import { useCallback, useEffect, useRef, useState } from 'react'

export function ChatMessage({ message }: { message: ChatMessageType }) {
  // listen to webcontents.send for this id and render the message
  const [responseContent, setResponseContent] = useState('')

  const responseContainerRef = useRef<HTMLDivElement>(null)

  const messageCallback = useCallback((chunk: string) => {
    if (!responseContainerRef.current) return
    setResponseContent((prev) => prev + chunk)
  }, [])

  useEffect(() => {
    return window.chat.onChunkReceived(message.id, messageCallback)
  }, [])

  return (
    <div
      key={message.id}
      className="rounded-md border bg-gray-100 border-gray-200 mb-2 shadow text-sm overflow-hidden *:p-2"
    >
      {message.highlightedText && (
        <div className="text-gray-400 border-b border-gray-200">
          <div className="text-xs text-gray-500 mb-2">Highlighted text</div>
          {message.highlightedText}
        </div>
      )}
      <div className="border-b border-gray-200">
        <div className="text-xs text-gray-500 mb-2">Question</div>
        {message.userInput}
      </div>
      <div className="">
        <div className="text-xs text-gray-500 mb-2">Response</div>
        <div ref={responseContainerRef} className="text-wrap break-all">
          {!responseContent ? (
            <div className="flex items-center gap-2">
              <SpinningLoader classNames="mr-0 w-4" />
              Loading
            </div>
          ) : (
            responseContent
          )}
        </div>
      </div>
    </div>
  )
}
