import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { MathExtension } from '@aarkue/tiptap-math-extension'
import 'katex/dist/katex.min.css'
import { useEffect } from 'react'
import { Markdown } from 'tiptap-markdown'

interface MarkdownRendererProps {
  content: string
  className?: string
}

const extensions = [StarterKit, MathExtension, Markdown]

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const editor = useEditor({
    extensions: extensions,
    content: content,
    editable: false
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  return (
    <div className={`markdown-renderer ${className} prose`}>
      <EditorContent editor={editor} />
    </div>
  )
}
