import { useState, KeyboardEvent } from 'react'
import { Input } from '@defogdotai/agents-ui-components/core-ui'
import { Chat } from '@types'

export function ChatBar() {
  const [inputValue, setInputValue] = useState('')
  const [chat, setChat] = useState<Chat>({ messages: [] })
  const [loading, setLoading] = useState(false)

  const handleKeyPress = async (e: KeyboardEvent<HTMLInputElement>): Promise<void> => {
    const val = e.currentTarget.value
    if (e.key === 'Enter' && val.trim()) {
      try {
        setLoading(true)
        // For now, just log the message
        console.log('Sending message:', val)
        const chatMessage = await window.chat.sendChatMessage(val)

        setChat((chat) => {
          return { ...chat, messages: [...chat.messages, chatMessage] }
        })
        setInputValue('')
      } catch (error) {
        console.error('Error sending message:', error)
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="flex flex-col w-full h-full p-2 sticky top-0">
      <div className="chat-ctr h-full">
        {chat.messages.map((message, index) => (
          <div
            key={index}
            className="rounded-md border bg-gray-100 border-gray-200 mb-2 shadow text-sm"
          >
            <div className="border-b border-gray-200 p-2">
              <div className="text-xs text-gray-500 mb-2">Question</div>
              {message.prompt}
            </div>
            <div className="p-2">
              <div className="text-xs text-gray-500 mb-2">Answer</div>
              {message.response}
            </div>
          </div>
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
