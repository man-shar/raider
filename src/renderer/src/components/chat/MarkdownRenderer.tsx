import 'katex/dist/katex.min.css'
import 'katex/dist/fonts/KaTeX_Size2-Regular.woff2'
import 'katex/dist/fonts/KaTeX_Main-Regular.woff2'
import 'katex/dist/fonts/KaTeX_Math-Italic.woff2'
import { marked } from 'marked'
import { parseTextWithMath } from '@renderer/utils'

interface MarkdownRendererProps {
  content: string | any // Allow complex content types
  className?: string
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Ensure content is a string before passing to the editor
  const normalizedContent = parseTextWithMath(
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? JSON.stringify(content)
        : typeof content === 'object' && content !== null
          ? JSON.stringify(content)
          : String(content || '')
  )

  return (
    <div className={`markdown-renderer ${className} prose`}>
      <div
        className="prose dark:prose-invert prose-sm max-w-none py-1"
        dangerouslySetInnerHTML={{
          __html: marked.parse(normalizedContent).trim()
        }}
      />
    </div>
  )
}
