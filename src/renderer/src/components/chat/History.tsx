import { ConversationType } from '@types'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useClick } from '@renderer/hooks/useClick'

export const ConversationHistory = ({
  conversationHistory = [],
  onClick = () => {},
  activeConversation = null
}: {
  conversationHistory: ConversationType[]
  onClick: (conv: ConversationType | null) => void
  activeConversation: ConversationType | null
}) => {
  const [show, setShow] = useState(false)

  useClick({
    target: document.body,
    callback: (e) => {
      try {
        if (!e.currentTarget) return
        setShow(false)
      } catch (e) {
        console.error(e)
      }
    }
  })

  return (
    <div className="history-ctr overflow-auto drop-shadow-lg flex flex-col items-center justify-center mx-auto border bg-white border-b-2 border-gray-200 rounded-3xl text-xs text-gray-600">
      <div
        className="history-label w-full flex flex-row items-start justify-center gap-2 cursor-pointer bg-gray-50 shadow-sm p-2 font-bold text-gray-500 sticky top-0"
        onClick={(e) => {
          // to not conflict with the useclick above. this is fired first, then bubbles up to the body
          // prevent bubbling here
          e.preventDefault()
          e.stopPropagation()
          setShow(!show)
        }}
      >
        {show ? 'Hide' : 'Show'} History
      </div>
      <div
        className={twMerge(
          'grow flex flex-col w-full text-sm  transition-all duration-300 ease-in-out transform origin-top',
          show ? 'h-96' : 'h-0 overflow-hidden'
        )}
      >
        <span
          onClick={() => onClick(null)}
          className={twMerge(
            'hover:bg-gray-200 cursor-pointer p-2',
            !activeConversation ? 'bg-gray-200 font-bold' : ''
          )}
        >
          New
        </span>
        {conversationHistory
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
          .map((item) => {
            return (
              <span
                key={item.id}
                onClick={() => onClick(item)}
                className={twMerge(
                  'hover:bg-gray-200 cursor-pointer p-2',
                  activeConversation?.id === item.id ? 'bg-gray-200 font-bold' : ''
                )}
              >
                {item.messages[1].displayContent ?? item.messages[1].content}
              </span>
            )
          })}
      </div>
    </div>
  )
}
