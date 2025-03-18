import { MessageWithHighlights } from '@types'
import { forwardRef, Ref, RefCallback, useCallback, useContext, useEffect, useState } from 'react'
import { MarkdownRenderer } from './MarkdownRenderer'
import { Modal, SpinningLoader } from '@defogdotai/agents-ui-components/core-ui'
import { AppContext } from '@renderer/context/AppContext'

const Message = forwardRef(
  (
    { message }: { message: MessageWithHighlights },
    ref: Ref<HTMLDivElement> | RefCallback<HTMLDivElement>
  ) => {
    const { statusManager } = useContext(AppContext)
    // Only render markdown for assistant messages to avoid processing user input as markdown
    // listen to webcontents.send for this id and render the conversation
    // Extract images from content
    const [extractedImages, setExtractedImages] = useState<Array<{ url: string; type: string }>>([])

    // Text-only processing for string content (used for streaming chunks)
    const processTextContent = (content: any): string => {
      // If it's a string, return it directly without any JSON parsing
      if (typeof content === 'string') {
        return content
      }

      // If it's an array, extract only the text parts
      if (Array.isArray(content)) {
        return content
          .filter((item) => item.type === 'text')
          .map((item) => item.text)
          .join('\n')
      }

      // For other types, convert to string
      return String(content || '')
    }

    // Extract images and text on component mount or message change
    useEffect(() => {
      // Skip string content - don't try to parse JSON from strings
      if (typeof message.content === 'string') {
        return
      }

      // For object content, process directly
      if (Array.isArray(message.content)) {
        // Extract images
        const images = message.content
          .filter(
            (item) =>
              (item.type === 'image_url' && item.image_url?.url) ||
              (item.type === 'image' && item.source?.data)
          )
          .map((item) => {
            if (item.type === 'image_url') {
              return { url: item.image_url.url, type: 'image_url' }
            } else if (item.type === 'image') {
              // For Anthropic format
              const mediaType = item.source.media_type || 'image/png'
              return {
                url: `data:${mediaType};base64,${item.source.data}`,
                type: 'image'
              }
            }
            return null
          })
          .filter((d) => d !== null)

        // Update images state if we found any
        if (images.length > 0) {
          setExtractedImages(images)
        }
      }
    }, [message.content]) // Only run when message content changes

    // Initialize content state from message
    const [content, setContent] = useState<string>(() => {
      return processTextContent(message.displayContent ?? message.content)
    })

    // Update content when message changes (non-streaming)
    useEffect(() => {
      if (!message.isLoading) {
        setContent(processTextContent(message.displayContent ?? message.content))
      }
    }, [message.content, message.isLoading])

    useEffect(() => {
      if (message.isLoading && message.terminateString) {
        console.log('being called', message)
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
            setContent((prev) => prev + processTextContent(chunk))
          }
        }
        const unsubChunk = window.chat.onChunkReceived(message.id, messageCallback)

        return () => {
          unsubChunk()
        }
      }

      return () => {}
    }, [])

    const [imageModalOpen, setImageModalOpen] = useState(false)
    const [selectedImage, setSelectedImage] = useState<{ url: string; type: string } | null>(null)

    const handleImageClick = useCallback((image: { url: string; type: string }) => {
      setSelectedImage(image)
      setImageModalOpen(true)
    }, [])

    const handleCloseImageModal = useCallback(() => {
      setImageModalOpen(false)
      setSelectedImage(null)
    }, [])

    return (
      <div className="my-2 space-y-2 relative">
        {message.highlightedText && (
          <div className="text-gray-400 border-b border-gray-200 pb-2">
            <div className="text-xs text-gray-500 mb-2">Highlighted text</div>
            {message.highlightedText}
          </div>
        )}
        <div className="text-xs text-gray-500 mb-2 w-full">
          <span className="grow">{message.role === 'user' ? 'Question' : 'Response'}</span>
        </div>
        <span
          className="text-xs self-end text-gray-300 cursor-pointer absolute top-1 right-2"
          onClick={() => console.log(message)}
          title="Click to log message details in console"
        >
          Log
        </span>
        <div className="text-wrap break-all">
          {message.isLoading && !content ? (
            <div className="text-wrap break-all text-xs flex flex-row items-center gap-1" ref={ref}>
              <SpinningLoader classNames="w-4 m-0" /> Loading
            </div>
          ) : (
            <div ref={ref as Ref<HTMLDivElement>}>
              {/* Show message content */}
              <MarkdownRenderer content={content} />

              {/* Show extracted images for user messages */}
              {extractedImages.length > 0 && (
                <div className="text-gray-400 border-y p-2 border-gray-200 text-xs relative">
                  <div className="text-gray-500 mb-2">Images</div>
                  <div className="flex flex-row flex-wrap gap-2 pb-2">
                    {extractedImages.map((image, idx) => (
                      <div
                        key={idx}
                        className="relative w-20 h-20 flex items-center justify-center rounded-md border p-1 cursor-pointer hover:border-gray-400 hover:shadow-inner"
                        onClick={() => handleImageClick(image)}
                      >
                        <img
                          src={image.url}
                          alt={`Image ${idx + 1}`}
                          className="rounded-md border border-gray-300 max-w-full"
                          style={{ maxHeight: '200px' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <Modal
          open={selectedImage && imageModalOpen ? true : false}
          onCancel={handleCloseImageModal}
          footer={false}
        >
          {selectedImage?.url && <img src={selectedImage?.url} />}
        </Modal>
      </div>
    )
  }
)

export function Conversation({ messages }: { messages: MessageWithHighlights[] }) {
  console.log('Rerender', messages)
  return (
    <div className="text-sm overflow-hidden *:p-2 divide-y">
      {messages
        .filter((d) => d.role !== 'system')
        .map((message, i) => {
          // If this is the last message and it's an assistant message being streamed
          if (i === messages.length - 2 && message.role === 'assistant') {
            return <Message key={`${message.id}`} message={message} />
          }

          return <Message key={`${message.id}`} message={message} />
        })}
    </div>
  )
}
