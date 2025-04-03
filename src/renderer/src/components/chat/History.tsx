import { ConversationType } from '@types'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useClick } from '@renderer/hooks/useClick'
import { ChevronDownIcon, Trash } from 'lucide-react'
import { Button } from '@defogdotai/agents-ui-components/core-ui'

export const ConversationHistory = ({
  conversationHistory = [],
  onClick = () => {},
  activeConversation = null,
  onDelete = () => {}
}: {
  conversationHistory: ConversationType[]
  onClick: (conv: ConversationType | null) => void
  onDelete: (conv: ConversationType, idx: number) => void
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
    <div className="history-ctr overflow-auto text-sm text-gray-600 border bg-gray-100 rounded-md *:transition-all *:duration-400">
      <div
        className="history-label w-full gap-2 cursor-pointer p-2 italic text-gray-500 text-md sticky top-0"
        onClick={(e) => {
          // to not conflict with the useclick above. this is fired first, then bubbles up to the body
          // prevent bubbling here
          e.preventDefault()
          e.stopPropagation()
          setShow(!show)
        }}
      >
        {!activeConversation ? 'New conversation' : activeConversation.messages[0].displayContent}
        <ChevronDownIcon
          className={twMerge(
            'w-4 h-4 absolute right-0 top-1/2 -translate-1/2 text-gray-400 transition-transform',
            show ? '' : '-rotate-90'
          )}
        />
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
            !activeConversation ? 'bg-gray-200 font-bold text-gray-800' : 'hover:text-gray-500'
          )}
        >
          New
        </span>
        {conversationHistory
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
          .map((item, idx) => {
            return (
              <div
                onClick={() => onClick(item)}
                className={twMerge(
                  'flex items-center flex-row hover:bg-gray-200 cursor-pointer p-2',
                  activeConversation?.id === item.id
                    ? 'bg-gray-200 font-bold text-gray-800'
                    : 'hover:text-gray-500'
                )}
              >
                <span key={item.id} className="grow">
                  {item.messages[0].displayContent ?? JSON.stringify(item.messages[0].content)}
                </span>
                <Button
                  className="bg-gray-200 self-end group cursor-pointer hover:bg-gray-100/70 px-1 py-0 border border-transparent hover:border-gray-300 border-b-2 rounded-md"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    onDelete(item, idx)
                    setShow(!show)
                  }}
                >
                  <Trash className="w-4 stroke-gray-400 group-hover:stroke-gray-600" />
                </Button>
              </div>
            )
          })}
      </div>
    </div>
  )
}
