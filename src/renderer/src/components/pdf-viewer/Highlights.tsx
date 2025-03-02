import { HighlightType } from '@types'
import 'tippy.js/dist/tippy.css'
import Tippy from '@tippyjs/react/headless' // different import path!
import KeyIcon from '../utils/KeyIcon'

interface HighlightsProps {
  highlights: HighlightType[]
  width: number
  onHover: (highlight: HighlightType | null) => void
}

const classes = {
  hasConversation: 'fill-lime-200 opacity-80 group-hover:fill-lime-300',
  noConversation: 'fill-yellow-200 opacity-80 group-hover:fill-yellow-300'
}

export function Highlights({ highlights = [], width, onHover }: HighlightsProps) {
  return highlights.map((highlight) => {
    const scale = highlight.originalViewportWidth / width

    return (
      <svg
        className="absolute left-0 top-0 z-20 mix-blend-multiply pointer-events-none"
        key={highlight.id}
        width={'100%'}
        height={'100%'}
      >
        <Tippy
          onShown={() => console.log('shown')}
          render={(attrs) => (
            <div className="bg-white text-xs rounded-md border p-2" {...attrs}>
              <div className="flex flex-col gap-2">
                <KeyIcon meta={true} clickIcon={true} text={'Start conversation'} />
                <KeyIcon meta={true} keyValue={'r'} text={'Remove highlight'} />
              </div>
            </div>
          )}
          placement="top"
        >
          <g className="group cursor-pointer pointer-events-auto focus:outline-none">
            {highlight.chunks.map((chunk, chunkIndex) => (
              <rect
                onMouseEnter={() => onHover(highlight)}
                onMouseLeave={() => onHover(null)}
                key={chunkIndex}
                className={
                  highlight.has_conversation ? classes.hasConversation : classes.noConversation
                }
                width={`${chunk.width / scale}px`}
                height={`${(chunk.height + 4) / scale}px`}
                x={`${chunk.x / scale}px`}
                y={`${(chunk.y - 2) / scale}px`}
              />
            ))}
          </g>
        </Tippy>
      </svg>
    )
  })
}
