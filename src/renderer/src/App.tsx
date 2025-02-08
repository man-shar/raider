import type { RaiderFile } from '@types'
import { PDFDocument } from './components/pdf-viewer/PDFDocument'
import { useEffect, useRef, useState } from 'react'
import { pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'
import { twMerge } from 'tailwind-merge'
import { ChatBar } from './components/ChatBar'
import { Nav } from './components/Nav'
import {
  Button,
  Input,
  MessageManager,
  MessageManagerContext,
  MessageMonitor
} from '@defogdotai/agents-ui-components/core-ui'
import { AppContext } from './context/AppContext'
import { ChatManager } from './components/ChatManager'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

function App({ initialFiles }: { initialFiles: RaiderFile[] }) {
  const [addedFiles, setAddedFiles] = useState<RaiderFile[]>(initialFiles || [])
  const [selectedFile, setSelectedFile] = useState<RaiderFile | null>(
    initialFiles.length ? initialFiles[0] : null
  )

  useEffect(() => {
    if (!selectedFile) {
      setSelectedFile(addedFiles[0])
    }
  }, [addedFiles])

  const message = useRef(MessageManager())

  const handleSelectFile = useRef(async () => {
    console.log('selecting file')
    const { files, error } = await window.fileHandler.selectFile()
    if (error || !files) {
      message.current.error(error || 'Could not open file')
      return
    }
    console.log(files)
    setAddedFiles((d) => [...d, ...files])
  })

  return (
    <AppContext.Provider value={{ chatManager: ChatManager() }}>
      <MessageManagerContext.Provider value={message.current}>
        <MessageMonitor />
        <div className="prose min-w-screen h-screen relative">
          <div className="flex flex-row divide-x divide-gray-200 w-full h-full ">
            {addedFiles.length ? (
              <div className="sidebar min-w-96 max-w-96 h-screen bg-white">
                <ChatBar />
              </div>
            ) : null}
            <div className="view-ctr grow overflow-scroll">
              <Nav
                selectedFile={selectedFile}
                files={addedFiles}
                setSelectedFile={setSelectedFile}
                addFileClick={handleSelectFile.current}
                closeFile={async (file, idx) => {
                  // try closing file in the db first
                  const { error } = await window.fileHandler.closeFile(file.path)
                  if (error) {
                    // we still want to close the file in the UI, so ignore the error, but log it
                    console.error(error)
                  }

                  const newFiles = addedFiles.filter((f, i) => i !== idx)
                  if (!newFiles.length) {
                    setSelectedFile(null)
                  } else {
                    setSelectedFile(
                      newFiles[idx + 1 > newFiles.length - 1 ? newFiles.length - 1 : idx + 1]
                    )
                  }
                  setAddedFiles(newFiles)
                }}
              />

              <div className="files relative">
                {addedFiles.map((file, index) => (
                  <div
                    key={index}
                    className={twMerge(
                      'relative z-2',
                      selectedFile !== file &&
                        'absolute opacity-0 pointer-events-none top-0 left-0 -z-10'
                    )}
                  >
                    <PDFDocument file={file} />
                  </div>
                ))}
              </div>

              {!selectedFile && (
                <div className="flex mx-auto px-2 w-full max-w-96 items-center justify-center h-full w-full">
                  <div className="group cursor-pointer grow">
                    <div className="border-1 p-2 rounded-md border-gray-300 divide-y divide-gray-300">
                      <Button
                        className="mb-5 w-full justify-center cursor-pointer"
                        variant="primary"
                        onClick={handleSelectFile.current}
                      >
                        <div>Click to select files</div>
                      </Button>
                      <Input
                        label="Or paste a URL"
                        placeholder="Enter URL"
                        inputClassNames="w-full text-sm focus:outline-none p-2 shadow-none"
                        onPressEnter={async (e) => {
                          const { file, error } = await window.fileHandler.openURL(
                            e.currentTarget.value
                          )

                          if (error || !file) {
                            message.current.error(error || 'Could not open URL')
                            return
                          }

                          console.log(file)
                          setAddedFiles((d) => [...d, file])
                          e.stopPropagation()
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </MessageManagerContext.Provider>
    </AppContext.Provider>
  )
}

export default App
