import { forwardRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import tw from '@assets/tooltip.css?raw'

export const IFrame = forwardRef<HTMLIFrameElement, React.ComponentPropsWithoutRef<'iframe'>>(
  ({ children, ...props }, ref) => {
    const [contentRef, setContentRef] = useState<HTMLIFrameElement | null>(null)
    const mountNode = contentRef?.contentWindow?.document?.body

    useEffect(() => {
      // inject tailwind css into iframe
      const interval = setInterval(() => {
        const doc = contentRef?.contentWindow?.document
        if (doc) {
          const style = doc.createElement('style')
          style.appendChild(doc.createTextNode(tw))
          mountNode?.appendChild(style)
          clearInterval(interval)
        }
      }, 1000)

      return () => clearInterval(interval)
    }, [contentRef])

    return (
      <iframe
        {...props}
        ref={(node) => {
          setContentRef(node)
          if (typeof ref === 'function') {
            ref(node)
          } else if (ref) {
            ref.current = node
          }
        }}
      >
        {mountNode && createPortal(children, mountNode)}
      </iframe>
    )
  }
)
