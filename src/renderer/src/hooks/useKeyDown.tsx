import { useEffect } from 'react'

export const useKeyDown = (
  {
    key,
    ctrl = false,
    meta = false,
    shift = false,
    alt = false,
    target,
    callback = () => {}
  }: {
    key: string
    ctrl?: boolean
    meta?: boolean
    shift?: boolean
    alt?: boolean
    target?: HTMLElement | null
    callback: (e: KeyboardEvent) => void
  },
  deps: any[] = []
) => {
  useEffect(() => {
    const isDocumentTarget = target ? false : true
    const targetResolved = isDocumentTarget ? document : target

    const keyDownHandler = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent
      const isMac = window.navigator.platform.includes('Mac')

      if (
        keyboardEvent.key.toLowerCase() === key.toLowerCase() &&
        ((meta && (isMac ? keyboardEvent.metaKey : keyboardEvent.ctrlKey)) ||
          (!meta && !(isMac ? keyboardEvent.metaKey : keyboardEvent.ctrlKey))) &&
        ((ctrl && keyboardEvent.ctrlKey) || (!ctrl && !keyboardEvent.ctrlKey)) &&
        ((shift && keyboardEvent.shiftKey) || (!shift && !keyboardEvent.shiftKey)) &&
        ((alt && keyboardEvent.altKey) || (!alt && !keyboardEvent.altKey))
      ) {
        keyboardEvent.stopPropagation()
        keyboardEvent.preventDefault()
        callback(keyboardEvent)
      }
    }

    targetResolved.addEventListener('keydown', keyDownHandler)
    return () => {
      targetResolved.removeEventListener('keydown', keyDownHandler)
    }
  }, [target, key, callback, ...deps])
}
