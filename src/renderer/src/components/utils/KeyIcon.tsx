import { CommandIcon, MousePointerClick } from 'lucide-react'
import React from 'react'

interface KeyIconProps {
  className?: string
  keyValue?: string | null
  clickIcon?: boolean
  meta?: boolean
  text?: string | null
}

export const KeyIcon: React.FC<KeyIconProps> = ({
  className = '',
  keyValue = null,
  clickIcon = false,
  meta = false,
  text = null
}) => {
  return (
    <div className="text-xs flex items-center font-mono gap-1">
      <kbd className={className}>
        {meta && <CommandIcon width={10} height={10} />}
        {keyValue}
        {clickIcon && <MousePointerClick width={17} />}
      </kbd>
      {text && <span className="font-mono">{text}</span>}
    </div>
  )
}

export default KeyIcon
