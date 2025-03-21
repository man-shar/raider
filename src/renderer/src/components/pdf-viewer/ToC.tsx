import React, { useEffect, useRef } from 'react'
import LinkService from 'react-pdf/src/LinkService.js'
import '@renderer/assets/pdf-outline.css'
import { twMerge } from 'tailwind-merge'

interface OutlineItemType {
  dest: string | null
  title: string
  items: OutlineItemType[]
  destRef?: {
    num: number
  }
}

interface ToCProps {
  outline: OutlineItemType[]
  linkService: LinkService | null
  hidden?: boolean
}

const OutlineItem: React.FC<{
  item: OutlineItemType
  linkService: LinkService | null
  level?: number
}> = ({ item, linkService, level = 0 }) => {
  const handleClick = () => {
    if (item.dest && linkService) {
      linkService.goToDestination(item.dest)
    }
  }

  const getOpacity = () => {
    return 1 - level * 0.15 > 0.5 ? 1 - level * 0.15 : 0.5
  }

  return (
    <div className="outline-item">
      <div
        className="flex items-center py-1.5 px-2 hover:bg-gray-100 rounded transition-colors cursor-pointer"
        onClick={handleClick}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <div
          className="text-ellipsis overflow-hidden whitespace-nowrap flex-grow text-sm"
          style={{ opacity: getOpacity() }}
        >
          {item.title}
        </div>
        {item.destRef?.num && <div className="text-gray-500 text-xs ml-2">{item.destRef.num}</div>}
      </div>

      {item.items && item.items.length > 0 && (
        <div className="nested-items">
          {item.items.map((nestedItem, i) => (
            <OutlineItem
              key={`${nestedItem.title}-${i}`}
              item={nestedItem}
              linkService={linkService}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const ToC: React.FC<ToCProps> = ({ outline, linkService, hidden }) => {
  const sidebarRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={sidebarRef}
      className={twMerge(
        'z-5 sticky top-[50vh] -translate-y-1/2 ml-14 h-0 transition-all',
        hidden ? 'opacity-0' : 'opacity-100'
      )}
    >
      <div className="w-80 bg-gray-50 rounded-md border shadow p-2 -translate-y-1/3 ">
        <h3 className="text-xs font-light mt-0 p-1 text-gray-70 uppercase">Contents</h3>
        <div className="outline-items max-h-80 overflow-scroll">
          {outline.map((item, i) => (
            <OutlineItem key={`${item.title}-${i}`} item={item} linkService={linkService} />
          ))}
        </div>
      </div>
    </div>
  )
}
