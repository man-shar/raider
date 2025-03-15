import { useEffect } from 'react'

export const useClick = (
  {
    meta = false,
    ctrl = false,
    shift = false,
    alt = false,
    target,
    callback = () => {}
  }: {
    meta?: boolean
    ctrl?: boolean
    shift?: boolean
    alt?: boolean
    target?: HTMLElement | Document | null
    callback: (e: MouseEvent) => void
  },
  deps: any[] = []
) => {
  useEffect(() => {
    const targetResolved = target ?? document

    const clickHandler = (event: Event) => {
      const mouseEvent = event as MouseEvent
      const isMac = window.navigator.platform.includes('Mac')

      if (
        ((meta && (isMac ? mouseEvent.metaKey : mouseEvent.ctrlKey)) ||
          (!meta && !(isMac ? mouseEvent.metaKey : mouseEvent.ctrlKey))) &&
        ((ctrl && mouseEvent.ctrlKey) || (!ctrl && !mouseEvent.ctrlKey)) &&
        ((shift && mouseEvent.shiftKey) || (!shift && !mouseEvent.shiftKey)) &&
        ((alt && mouseEvent.altKey) || (!alt && !mouseEvent.altKey))
      ) {
        mouseEvent.stopPropagation()
        mouseEvent.preventDefault()
        callback(mouseEvent)
      }
    }

    targetResolved.addEventListener('click', clickHandler)
    return () => {
      targetResolved.removeEventListener('click', clickHandler)
    }
  }, [callback, ...deps])
}
