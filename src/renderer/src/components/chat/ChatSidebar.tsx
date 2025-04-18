import {
  KeyboardEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import { Conversation } from './Conversation'
import { X } from 'lucide-react'
import { PDFManager } from '../pdf-viewer/PDFManager'
import { ConversationHistory } from './History'
import { ConversationType } from '@types'
import KeyboardShortcutIndicator from '../utils/KeyboardShortcutIndicator'
import { useKeyDown } from '@renderer/hooks/useKeyDown'
import { LyricDisplay, tracks } from '../utils/lyrics'

interface PastedImage {
  id: string
  loading: boolean
  base64: string | null
}

interface PastedImageMap {
  [id: string]: PastedImage
}

export function ChatSidebar({ fileManager }: { fileManager: PDFManager }) {
  const { chatManager } = useContext(AppContext)
  const message = useContext(MessageManagerContext)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  const activeHighlight = useSyncExternalStore(
    chatManager.subscribeToActiveHighlight,
    chatManager.getActiveHighlight
  )

  const file = useSyncExternalStore(fileManager?.subscribe, fileManager?.getFile)

  const loading = useSyncExternalStore(chatManager.subscribeToLoading, chatManager.getLoading)

  const [images, setImages] = useState<PastedImageMap>({})

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

  const conversations = useMemo(() => file.conversation_history, [file])

  useEffect(() => {
    setActiveConversation(conversations?.length ? conversations[0] : null)
  }, [fileManager])

  const [activeConversation, setActiveConversation] = useState<ConversationType | null>(null)

  const handleKeyPress = useCallback(
    async (e: KeyboardEvent<HTMLTextAreaElement>): Promise<void> => {
      if (!textAreaRef.current) return

      const val = e.currentTarget.value
      if (e.key === 'Enter' && val.trim()) {
        try {
          if (!fileManager) throw new Error('File manager not found')

          // Convert images to an array format for sending to AI
          const imageArray = Object.values(images).filter((img) => !img.loading && img.base64) // Only include images that have finished loading

          // For now, just log the message
          const newConversation = await chatManager
            .sendChatMessage({
              conversationId: activeConversation?.id || null,
              userInput: val,
              file: fileManager.getFile(),
              highlightedText: activeHighlight?.fullText || null,
              highlightId: activeHighlight?.id || null,
              highlightedPageNumber: activeHighlight?.pageNumber || null,
              images: imageArray.length > 0 ? imageArray : undefined
            })
            .catch((error) => {
              throw new Error(error)
            })

          if (fileManager) {
            fileManager.addOrUpdateConversationInHistory(newConversation)
            if (activeHighlight) {
              await fileManager.addOrUpdateHighlight({ ...activeHighlight, has_conversation: true })
            }
          }

          console.log('New received', newConversation)

          setActiveConversation(newConversation)

          setImages({})

          textAreaRef.current.value = ''
        } catch (error) {
          message.error(error.message)
        } finally {
          chatManager.setLoading(false)
          chatManager.setActiveHighlight(null)
        }
      }
    },
    [fileManager, activeHighlight, message, chatManager, activeConversation, images]
  )

  useKeyDown({
    key: 'l',
    meta: true,
    callback: () => {
      if (textAreaRef.current) {
        textAreaRef.current.focus()
      }
    }
  })

  useKeyDown({
    key: 'n',
    meta: true,
    callback: () => {
      setActiveConversation(null)
    }
  })

  const [activeTrackIndex, setActiveTrackIndex] = useState(0)

  return (
    <>
      <div className="flex flex-col w-full h-full p-2 sticky top-0">
        <div className="sticky top-0 mx-auto w-full">
          <ConversationHistory
            conversationHistory={conversations}
            onClick={(item) => {
              setActiveConversation(item)
              if (!item) {
                setActiveTrackIndex((prev) => {
                  return (prev + 1) % tracks.length
                })
              }
            }}
            onDelete={async (item, idx) => {
              if (!item) return

              console.log('delete', item)
              try {
                await fileManager.removeConversationFromHistory(item)
                if (!activeConversation) return
                if (item.id === activeConversation.id) {
                  // if this was the active conversation, set the active to the one before it
                  setActiveConversation(idx === 0 ? null : conversations[idx - 1])
                }
              } catch (e) {
                console.error(e)
                message.error(e)
              }
            }}
            activeConversation={activeConversation}
          />
        </div>
        <div className="chat-ctr h-full overflow-auto">
          {activeConversation ? (
            <Conversation key={activeConversation.id} messages={activeConversation.messages} />
          ) : (
            // <div className="grow flex overflow-visible items-center justify-center text-xs text-gray-400 h-full">
            //   <LyricDisplay track={tracks[activeTrackIndex]} />
            // </div>
            <div className="grow flex overflow-visible items-center justify-start p-2 text-xs text-gray-400 h-full">
              Start asking below
            </div>
          )}
        </div>

        <div className="rounded-2xl divide-y space-y-3 bg-gray-50 border border-gray-300 border-b-2 shadow-lg p-2">
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
            label={
              <div className="space-x-1 text-gray-400 text-xs font-light">
                <span>Continue chatting</span>
                <KeyboardShortcutIndicator keyValue="L" meta inline />
                <span>or start a new conversation</span>
                <KeyboardShortcutIndicator keyValue="N" meta inline />
              </div>
            }
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
    </>
  )
}
