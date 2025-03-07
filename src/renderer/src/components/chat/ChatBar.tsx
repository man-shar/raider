import {
  KeyboardEvent,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import {
  MessageManagerContext,
  Modal,
  SpinningLoader,
  TextArea
} from '@defogdotai/agents-ui-components/core-ui'
import { AppContext } from '@renderer/context/AppContext'
import { ChatMessage } from './ChatMessage'
import { X } from 'lucide-react'
import { PDFManager } from '../pdf-viewer/PDFManager'

interface PastedImage {
  id: string
  loading: boolean
  base64?: string | null
}

interface PastedImageMap {
  [id: string]: PastedImage
}

export function ChatBar({
  fileText,
  fileManager
}: {
  fileText: string | null
  fileManager: PDFManager | null
}) {
  const { chatManager } = useContext(AppContext)
  const message = useContext(MessageManagerContext)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  const activeHighlight = useSyncExternalStore(
    chatManager.subscribeToActiveHighlight,
    chatManager.getActiveHighlight
  )

  const activeFile = useSyncExternalStore(
    chatManager.subscribeToActiveFile,
    chatManager.getActiveFile
  )

  const messages = useSyncExternalStore(
    chatManager.subscribeToChatMessages,
    chatManager.getMessages
  )

  const loading = useSyncExternalStore(chatManager.subscribeToLoading, chatManager.getLoading)

  const [images, setImages] = useState<PastedImageMap>({})

  const handleKeyPress = useCallback(
    async (e: KeyboardEvent<HTMLInputElement>): Promise<void> => {
      if (!textAreaRef.current) return

      const val = e.currentTarget.value
      if (e.key === 'Enter' && val.trim()) {
        try {
          if (fileText === null) {
            console.warn('File text not extracted yet. Still sending message.')
          }

          // For now, just log the message
          chatManager
            .sendChatMessage({
              userInput: val,
              file: activeFile,
              highlightedText: activeHighlight?.fullText || null,
              highlightId: activeHighlight?.id || null,
              fileText: fileText
            })
            .catch((error) => {
              throw new Error(error)
            })

          if (fileManager && activeHighlight) {
            await fileManager.addOrUpdateHighlight({ ...activeHighlight, has_conversation: true })
          }

          textAreaRef.current.value = ''
        } catch (error) {
          console.error('Error sending message:' + error)
          message.error('Error sending message:' + error)
        } finally {
          chatManager.setLoading(false)
          chatManager.setActiveHighlight(null)
        }
      }
    },
    [fileManager, fileText, activeHighlight]
  )

  useEffect(() => {
    if (activeHighlight) {
      textAreaRef.current?.focus()
    } else {
      textAreaRef.current?.blur()
    }
  }, [activeHighlight])

  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<PastedImage | null>(null)

  const handleImageClick = useCallback((image: PastedImage) => {
    setSelectedImage(image)
    setImageModalOpen(true)
  }, [])

  const handleCloseImageModal = useCallback(() => {
    setImageModalOpen(false)
    setSelectedImage(null)
  }, [])

  const handleImageRemove = useCallback((id: string) => {
    setImages((prev) => {
      const newImages = { ...prev }
      delete newImages[id]
      return newImages
    })
  }, [])

  return (
    <div className="flex flex-col w-full h-full p-2 sticky top-0 z-20">
      <div className="chat-ctr h-full overflow-auto">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </div>
      <div className="rounded-2xl divide-y space-y-3 bg-gray-50 border border-gray-300 p-2 shadow-md">
        {activeHighlight && (
          <div className="text-gray-400 border-b pb-2 border-gray-200 text-xs relative max-h-60 overflow-auto">
            <div className="text-gray-500 mb-2">Highlighted text</div>

            {activeHighlight.fullText}

            <X
              className="absolute w-4 h-4 top-0 right-1 cursor-pointer hover:stroke-3"
              onClick={() => {
                chatManager.setActiveHighlight(null)
              }}
            />
          </div>
        )}

        {Object.values(images).length > 0 && (
          <div className="text-gray-400 border-b pb-2 border-gray-200 text-xs relative">
            <div className="text-gray-500 mb-2">Images</div>
            <div className="flex flex-row flex-wrap gap-2 pb-2">
              {Object.values(images).map((image) => (
                <div
                  key={image.id}
                  className="relative w-20 h-20 flex items-center justify-center rounded-md border p-1 cursor-pointer hover:border-gray-400 hover:shadow-inner"
                  onClick={() => handleImageClick(image)}
                >
                  {!image.base64 ? (
                    <SpinningLoader />
                  ) : (
                    <img src={image.base64} alt={`Image ${image.id}`} />
                  )}
                  <X
                    className="absolute w-5 h-5 -top-1 -right-1 cursor-pointer hover:stroke-3 hover:stroke-gray-600 bg-gray-200 rounded-full p-1"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleImageRemove(image.id)
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <TextArea
          textAreaHtmlProps={{
            onPaste: (e) => {
              const initialValue = e.currentTarget.value

              // deal with images
              const items = e.clipboardData.items
              const pastedImages: PastedImageMap = {}

              for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image/') === 0) {
                  const id = crypto.randomUUID()
                  pastedImages[id] = { id, loading: true, base64: null }

                  e.currentTarget.value = e.currentTarget.value + '\n' + items[i].getAsFile()

                  // get base 64 and add to images
                  const reader = new FileReader()
                  reader.onload = () => {
                    const base64 = reader.result as string
                    setImages((prev) => ({ ...prev, [id]: { id, loading: false, base64 } }))
                  }

                  reader.readAsDataURL(items[i].getAsFile() as File)
                }
              }

              setImages((prev) => ({ ...prev, ...pastedImages }))

              e.currentTarget.value = initialValue
            }
          }}
          disabled={loading}
          rootClassNames="sticky bottom-0"
          textAreaClassNames="max-h-60 overflow-auto shadow-none"
          label={'Ask a question here'}
          placeholder="Paste images or text"
          onKeyDown={handleKeyPress}
          autoResize={true}
          defaultRows={1}
          ref={textAreaRef}
        ></TextArea>
      </div>

      <Modal
        open={selectedImage && imageModalOpen ? true : false}
        onCancel={handleCloseImageModal}
        footer={false}
      >
        {selectedImage?.base64 && <img src={selectedImage?.base64} />}
      </Modal>
    </div>
  )
}
