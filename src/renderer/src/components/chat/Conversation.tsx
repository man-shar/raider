import { MessageWithHighlights } from '@types'
import { forwardRef, Ref, RefCallback, useContext, useEffect, useState } from 'react'
import { MarkdownRenderer } from './MarkdownRenderer'
import { SpinningLoader } from '@defogdotai/agents-ui-components/core-ui'
import { AppContext } from '@renderer/context/AppContext'

const Message = forwardRef(
  (
    { message }: { message: MessageWithHighlights },
    ref: Ref<HTMLDivElement> | RefCallback<HTMLDivElement>
  ) => {
    const { statusManager } = useContext(AppContext)
    // Only render markdown for assistant messages to avoid processing user input as markdown
    // listen to webcontents.send for this id and render the conversation
    const [content, setContent] = useState(message.displayContent || message.content)

    useEffect(() => {
      if (message.isLoading && message.terminateString) {
        // Create a task for this message generation
        const taskId = statusManager.addTask({
          type: 'chat_completion',
          label: 'Generating response...'
        })

        statusManager.startTask(taskId)

        const messageCallback = (chunk: string) => {
          // Check if this is the terminate string
          if (chunk === message.terminateString) {
            // Message is complete, mark the task as completed
            statusManager.completeTask(taskId)
          } else {
            // Normal content chunk, add it to the state
            setContent((prev) => prev + chunk)
          }
        }

        console.log('subbing', message.id)
        const unsubChunk = window.chat.onChunkReceived(message.id, messageCallback)

        return () => {
          unsubChunk()
        }
      }

      return () => {}
    }, [])

    return (
      <div className="my-2 space-y-2 bg-gray-100 border border-gray-200 rounded-md">
        {message.highlightedText && (
          <div className="text-gray-400 border-b border-gray-200 pb-2">
            <div className="text-xs text-gray-500 mb-2">Highlighted text</div>
            {message.highlightedText}
          </div>
        )}
        <div className="text-xs text-gray-500 mb-2">
          {message.role === 'user' ? 'Question' : 'Response'}
        </div>
        <div className="text-wrap break-all">
          {message.isLoading && !content ? (
            <div className="text-wrap break-all text-xs flex flex-row items-center gap-1" ref={ref}>
              <SpinningLoader classNames="w-4 m-0" /> Loading
            </div>
          ) : (
            <div ref={ref as Ref<HTMLDivElement>}>
              <MarkdownRenderer content={content} />
            </div>
          )}
        </div>
      </div>
    )
  }
)

export function Conversation({ messages }: { messages: MessageWithHighlights[] }) {
  return (
    <div className="text-sm overflow-hidden *:p-2">
      {messages
        .filter((d) => d.role !== 'system')
        .map((message, i) => {
          // If this is the last message and it's an assistant message being streamed
          if (i === messages.length - 2 && message.role === 'assistant') {
            return <Message key={`${message.id}-${i}`} message={message} />
          }

          return <Message key={`${message.id}-${i}`} message={message} />
        })}
    </div>
  )
}
