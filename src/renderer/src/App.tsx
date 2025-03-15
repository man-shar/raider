import type { RaiderFile } from '@types'
import { PDFDocument } from './components/pdf-viewer/PDFDocument'
import { useEffect, useMemo, useRef, useState } from 'react'
import { pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'
import { twMerge } from 'tailwind-merge'
import { ChatSidebar } from './components/chat/ChatSidebar'
import { Nav } from './components/utils/Nav'
import {
  Button,
  Input,
  MessageManager,
  MessageManagerContext,
  MessageMonitor
} from '@defogdotai/agents-ui-components/core-ui'
import { AppContextProvider } from './context/AppContext'
import { Footer } from './components/footer/Footer'
import { PDFManager } from './components/pdf-viewer/PDFManager'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

function App({ initialFiles }: { initialFiles: RaiderFile[] }) {
  const [fileManagers, setFileManagers] = useState<PDFManager[]>(
    (initialFiles || []).map((file) => PDFManager(file))
  )
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(
    initialFiles.length ? initialFiles[0].path : null
  )

  const selectedFileManager = useMemo(() => {
    if (!selectedFilePath || !fileManagers || !fileManagers.length) return null
    return fileManagers.find((m) => m.getFile().path === selectedFilePath) || null
  }, [selectedFilePath, fileManagers])

  // These are now provided by AppContextProvider
  // const { current: chatManager } = useRef(ChatManager())
  // const { current: statusManager } = useRef(createStatusManager())

  useEffect(() => {
    if (!selectedFilePath && fileManagers.length) {
      setSelectedFilePath(fileManagers[0].getFile().path)
    }
  }, [fileManagers])

  const [fileTexts, setFileTexts] = useState<{
    [path: string]: { fullText: string | null; pageWiseText: { [page: number]: string } }
  }>(
    initialFiles.reduce((acc, file) => {
      acc[file.path] = {
        fullText: file.details.fullText || null,
        pageWiseText: file.details.pageWiseText || null
      }
      return acc
    }, {})
  )

  const message = useRef(MessageManager())

  const handleSelectFile = useRef(async () => {
    const { files, error } = await window.fileHandler.selectFile()
    if (error || !files) {
      message.current.error(error || 'Could not open file')
      return
    }
    setFileManagers((d) => [...d, ...files.map((file) => PDFManager(file))])
  })

  return (
    <AppContextProvider>
      <MessageManagerContext.Provider value={message.current}>
        <MessageMonitor />
        <div className="prose min-w-screen h-screen relative flex flex-col max-h-full">
          <div className="flex flex-row divide-x divide-gray-200 w-full min-h-0 grow">
            {fileManagers.length ? (
              <div className="sidebar min-w-96 max-w-96 h-full bg-white">
                {selectedFilePath && selectedFileManager && (
                  <ChatSidebar
                    fileManager={selectedFileManager}
                    fileText={fileTexts?.[selectedFilePath]?.fullText || null}
                  />
                )}
              </div>
            ) : null}
            <div className="view-ctr grow overflow-scroll">
              <Nav
                selectedFilePath={selectedFilePath}
                fileManagers={fileManagers}
                setSelectedFilePath={setSelectedFilePath}
                addFileClick={handleSelectFile.current}
                closeFile={async (file, idx) => {
                  // try closing file in the db first
                  const { error } = await window.fileHandler.closeFile(file.path)
                  if (error) {
                    // we still want to close the file in the UI, so ignore the error, but log it
                    console.error(error)
                  }

                  const newFilesManagers = fileManagers.filter((_, i) => i !== idx)
                  if (!newFilesManagers.length) {
                    setSelectedFilePath(null)
                  } else {
                    const newIdx =
                      idx + 1 > newFilesManagers.length - 1 ? newFilesManagers.length - 1 : idx + 1
                    setSelectedFilePath(newFilesManagers[newIdx].filePath)
                  }
                  setFileManagers(newFilesManagers)
                }}
              />

              <div className="files relative">
                {fileManagers.map((mgr, index) => {
                  const file = mgr.getFile()

                  return (
                    <div
                      key={index}
                      className={twMerge(
                        'relative z-2',
                        selectedFilePath !== file.path &&
                          'absolute opacity-0 pointer-events-none top-0 left-0 -z-10'
                      )}
                    >
                      <PDFDocument
                        pdfManager={mgr}
                        onTextExtracted={async (fullText, pageWiseText) => {
                          await window.fileHandler.updateFileDetails(
                            file.path,
                            file.is_url,
                            file.name,
                            {
                              fullText,
                              pageWiseText
                            }
                          )

                          setFileTexts((d) => ({
                            ...d,
                            [file.path]: {
                              fullText,
                              pageWiseText
                            }
                          }))
                        }}
                      />
                    </div>
                  )
                })}
              </div>

              {!selectedFilePath && (
                <div className="flex mx-auto px-2 w-full max-w-96 items-center justify-center h-full">
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

                          setFileManagers((d) => [...d, PDFManager(file)])
                          e.stopPropagation()
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <Footer />
        </div>
      </MessageManagerContext.Provider>
    </AppContextProvider>
  )
}

export default App
