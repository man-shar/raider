import { HighlightType } from '@types'

interface HighlightsProps {
  highlights: HighlightType[]
  width: number
}

export function Highlights({ highlights, width }: HighlightsProps) {
  return (
    <div className="pdf-highlights absolute top-0 left-0 w-full h-full z-[1000] pointer-events-none mix-blend-multiply">
      {highlights.map((highlight, index) => {
        const scale = highlight.originalViewportWidth / width
        return (
          <div key={index} className="group">
            {highlight.chunks.map((chunk, chunkIndex) => (
              <div
                key={chunkIndex}
                className="absolute bg-yellow-200 opacity-80 duration-200  group-hover:bg-yellow-300"
                style={{
                  left: chunk.x / scale,
                  top: chunk.y / scale,
                  width: chunk.width / scale,
                  height: chunk.height / scale
                }}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
