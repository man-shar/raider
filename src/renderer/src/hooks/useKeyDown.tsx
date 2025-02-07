import { useEffect } from 'react'

export const useKeyDown = (
  {
    key,
    ctrl = false,
    callback = () => {}
  }: {
    key: string
    ctrl?: boolean
    callback: () => void
  },
  deps: any[] = []
) => {
  useEffect(() => {
    const keyDownHandler = (event: KeyboardEvent) => {
      if (event.key === key && (!ctrl || event.ctrlKey || event.metaKey)) {
        callback()
      }
    }

    window.addEventListener('keydown', keyDownHandler)
    return () => {
      window.removeEventListener('keydown', keyDownHandler)
    }
  }, [key, callback, ...deps])
}
