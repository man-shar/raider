import { useState, KeyboardEvent, useContext, useSyncExternalStore } from 'react'
import { Input, MessageManagerContext } from '@defogdotai/agents-ui-components/core-ui'
import { AppContext } from '@renderer/context/AppContext'
import { ChatMessage } from './ChatMessage'

export function ChatBar() {
  const [inputValue, setInputValue] = useState('')
  const { chatManager } = useContext(AppContext)
  const message = useContext(MessageManagerContext)

  const messages = useSyncExternalStore(
    chatManager.subscribeToChatMessages,
    chatManager.getMessages
  )

  const loading = useSyncExternalStore(chatManager.subscribeToLoading, chatManager.getLoading)

  const handleKeyPress = async (e: KeyboardEvent<HTMLInputElement>): Promise<void> => {
    const val = e.currentTarget.value
    if (e.key === 'Enter' && val.trim()) {
      try {
        // For now, just log the message
        chatManager.sendChatMessage({ userInput: val, highlightedText: '' }).catch((error) => {
          message.error('Error sending message:' + error)
        })

        setInputValue('')
      } catch (error) {
        message.error('Error sending message:' + error)
      } finally {
        chatManager.setLoading(false)
      }
    }
  }

  return (
    <div className="flex flex-col w-full h-full p-2 sticky top-0">
      <div className="chat-ctr h-full overflow-auto">
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </div>
      <Input
        disabled={loading}
        rootClassNames="sticky bottom-0"
        placeholder="Ask a question here..."
        onPressEnter={handleKeyPress}
      ></Input>
    </div>
  )
}
