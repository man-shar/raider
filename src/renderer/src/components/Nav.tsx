import { Plus, X } from 'lucide-react'
import type { PDFFile } from '@types'
import { twMerge } from 'tailwind-merge'

export function Nav({
  selectedFile,
  files,
  setSelectedFile,
  addFileClick,
  closeFile
}: {
  selectedFile: PDFFile | null
  files: PDFFile[]
  setSelectedFile: (file: PDFFile) => void
  addFileClick: () => void
  closeFile: (file: PDFFile) => void
}) {
  return files.length ? (
    <>
      <div className="tabs w-full h-10 flex flex-row border-b border-b-gray-200 fixed top-0 z-10 bg-white divide-x divide-gray-300">
        {files.map((file, index) => (
          <button
            key={index}
            className={twMerge(
              'bg-gray-100 px-2 text-xs flex flex-row items-center cursor-pointer border-t-2 border-t-transparent',
              selectedFile === file && 'bg-gray-200 border-t-2 border-t-blue-400'
            )}
            onClick={() => setSelectedFile(file)}
          >
            <span className="">{file.metadata.name}</span>
            <X
              className="w-3 ml-auto inline hover:stroke-3"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                closeFile(file)
              }}
            />
          </button>
        ))}
        {files.length !== 0 && (
          <button
            className={'group p-2 text-xs flex flex-row items-center cursor-pointer'}
            onClick={() => {
              addFileClick()
            }}
          >
            <Plus className="w-3 ml-auto inline group-hover:stroke-3" />
          </button>
        )}
      </div>
      {/* a buffer for things below the nav */}
      <div className="h-10 w-full"></div>
    </>
  ) : null
}
