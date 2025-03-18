import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { MathExtension } from '@aarkue/tiptap-math-extension'
import 'katex/dist/katex.min.css'
import { useEffect } from 'react'
import { Markdown } from 'tiptap-markdown'

interface MarkdownRendererProps {
  content: string | any // Allow complex content types
  className?: string
}

const extensions = [StarterKit, MathExtension, Markdown]

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Ensure content is a string before passing to the editor
  const normalizedContent = typeof content === 'string' 
    ? content 
    : Array.isArray(content)
      ? JSON.stringify(content)
      : typeof content === 'object' && content !== null
        ? JSON.stringify(content)
        : String(content || '')
  
  const editor = useEditor({
    extensions: extensions,
    content: normalizedContent,
    editable: false
  })

  useEffect(() => {
    if (editor) {
      const contentToSet = typeof content === 'string' 
        ? content 
        : Array.isArray(content)
          ? JSON.stringify(content)
          : typeof content === 'object' && content !== null
            ? JSON.stringify(content)
            : String(content || '')
            
      if (contentToSet !== editor.getHTML()) {
        editor.commands.setContent(contentToSet)
      }
    }
  }, [content, editor])

  return (
    <div className={`markdown-renderer ${className} prose`}>
      <EditorContent editor={editor} />
    </div>
  )
}
