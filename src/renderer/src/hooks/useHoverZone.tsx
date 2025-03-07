import { useEffect, useState } from 'react'

type AnchorPosition = 'top' | 'right' | 'bottom' | 'left'

interface UseHoverZoneProps {
  /**
   * The anchor position of the hover zone
   */
  anchor: AnchorPosition
  /**
   * The size of the zone as a percentage of screen width or height (depending on anchor)
   */
  size: number
  /**
   * Optional callback function to execute when hover state changes
   */
  onHoverChange?: (isHovering: boolean) => void
  /**
   * Optional threshold in pixels to adjust sensitivity
   */
  threshold?: number
}

/**
 * A hook that detects when the mouse hovers over a specific zone of the screen
 * @param options Configuration options for the hover zone
 * @returns Whether the mouse is currently hovering over the specified zone
 */
export const useHoverZone = (
  { anchor, size, onHoverChange, threshold = 0 }: UseHoverZoneProps,
  deps: any[] = []
): boolean => {
  const [isHovering, setIsHovering] = useState(false)

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const { clientX, clientY } = event
      const { innerWidth, innerHeight } = window

      let inZone = false

      switch (anchor) {
        case 'top':
          // Zone is at the top of the screen with height = size% of screen height
          inZone = clientY <= (innerHeight * size) / 100 + threshold
          break
        case 'right':
          // Zone is at the right of the screen with width = size% of screen width
          inZone = clientX >= innerWidth - (innerWidth * size) / 100 - threshold
          break
        case 'bottom':
          // Zone is at the bottom of the screen with height = size% of screen height
          inZone = clientY >= innerHeight - (innerHeight * size) / 100 - threshold
          break
        case 'left':
          // Zone is at the left of the screen with width = size% of screen width
          inZone = clientX <= (innerWidth * size) / 100 + threshold
          break
      }

      if (inZone !== isHovering) {
        setIsHovering(inZone)
        onHoverChange?.(inZone)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [anchor, size, threshold, onHoverChange, ...deps])

  return isHovering
}
