import { Plus, X } from 'lucide-react'
import type { RaiderFile } from '@types'
import { twMerge } from 'tailwind-merge'
import { PDFManager } from '../pdf-viewer/PDFManager'
import { SettingsButton, SettingsModal } from './SettingsModal'
import { useState } from 'react'

export function Nav({
  selectedFilePath,
  fileManagers,
  setSelectedFilePath,
  closeFile
}: {
  selectedFilePath: string | null
  fileManagers: PDFManager[]
  setSelectedFilePath: (filePath: string | null) => void
  closeFile: (file: RaiderFile, idx: number) => void
}) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  return (
    <>
      <div className="tabs w-full h-10 flex flex-row border-b border-b-gray-200 fixed top-0 z-2 bg-white divide-x divide-gray-300">
        {fileManagers.map((mgr, index) => {
          const file = mgr.getFile()

          return (
            <button
              key={index}
              className={twMerge(
                'bg-gray-100 px-2 text-xs flex flex-row items-center cursor-pointer border-t-2 border-t-transparent w-40',
                selectedFilePath === file.path && 'bg-gray-200 border-t-2 border-t-blue-400'
              )}
              title={file.name}
              onClick={() => setSelectedFilePath(file.path)}
            >
              <span className="max-w-full overflow-hidden overflow-ellipsis whitespace-nowrap">
                {file.name}
              </span>
              <X
                className="min-w-3 max-w-3 ml-auto inline hover:stroke-3"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  closeFile(file, index)
                }}
              />
            </button>
          )
        })}
        {fileManagers.length !== 0 && (
          <button
            className={twMerge(
              'group p-2 text-xs flex flex-row items-center cursor-pointer',
              !selectedFilePath ? 'bg-gray-200 border-t-2 border-t-blue-400' : ''
            )}
            onClick={() => {
              setSelectedFilePath(null)
            }}
          >
            <Plus
              className={twMerge(
                'w-3 inline group-hover:stroke-3',
                !selectedFilePath ? 'stroke-3' : ''
              )}
            />
          </button>
        )}

        <div className="self-end">
          <SettingsButton onClick={() => setIsSettingsOpen(true)} />
        </div>
      </div>
      {/* a buffer for things below the nav */}
      <div className="h-10 w-full"></div>

      {/* Settings modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  )
}
