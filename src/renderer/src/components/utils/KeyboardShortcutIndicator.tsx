import { CommandIcon, MousePointerClick } from 'lucide-react'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface KeyboardShortcutIndicatorProps {
  className?: string
  inline?: boolean
  keyValue?: string | null
  clickIcon?: boolean
  meta?: boolean
  text?: string | null
}

export const KeyboardShortcutIndicator: React.FC<KeyboardShortcutIndicatorProps> = ({
  className = '',
  inline = false,
  keyValue = null,
  clickIcon = false,
  meta = false,
  text = null
}) => {
  return (
    <div
      className={twMerge(
        'text-xs flex flex-row items-center font-mono gap-2',
        inline ? 'inline-flex' : '',
        className
      )}
    >
      <kbd>
        {meta && <CommandIcon width={10} height={10} />}
        {keyValue}
        {clickIcon && <MousePointerClick width={17} />}
      </kbd>
      {text && <span className="font-mono grow">{text}</span>}
    </div>
  )
}

export default KeyboardShortcutIndicator
