import type { PDFFile } from '@types'
import { PDFViewer } from './components/PDFViewer'
import { useRef, useState } from 'react'
import { pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'
import { twMerge } from 'tailwind-merge'
import { ChatBar } from './components/ChatBar'
import { Nav } from './components/Nav'
import {
  Input,
  DropFiles,
  MessageManager,
  MessageManagerContext,
  MessageMonitor,
  SpinningLoader
} from '@defogdotai/agents-ui-components/core-ui'
import { AppContext } from './context/AppContext'
import { ChatManager } from './components/ChatManager'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

function App() {
  const [addedFiles, setAddedFiles] = useState<PDFFile[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<PDFFile | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = (fileList: Array<File>) => {
    try {
      setLoading(true)
      // add the uploaded file to the files array
      if (fileList) {
        const bufs: Promise<ArrayBuffer>[] = Array.from(fileList).map((file) => file.arrayBuffer())

        Promise.all(bufs).then((bufs) => {
          const newFiles: PDFFile[] = bufs.map((buf, i) => {
            return {
              file: fileList[i],
              buf: buf.slice(0),
              metadata: {
                name: fileList[i].name
              }
            }
          })

          setAddedFiles((d) => [...d, ...newFiles])

          if (!selectedFile) {
            setSelectedFile(newFiles[0])
          }
          setLoading(false)
        })
      }
    } catch (e) {
      setLoading(false)
    }
  }

  return (
    <AppContext.Provider value={{ chatManager: ChatManager() }}>
      <MessageManagerContext.Provider value={MessageManager()}>
        <MessageMonitor />
        <div className="prose min-w-screen h-screen relative">
          {/* <input
            type="file"
            multiple
            ref={inputRef}
            className="hidden"
            onChange={onFileChange}
            accept="application/pdf"
          /> */}
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
                addFileClick={() => inputRef.current?.click()}
              />

              <div className="files relative">
                {addedFiles.map((file, index) => (
                  <div
                    key={index}
                    className={twMerge(
                      'relative z-2',
                      selectedFile !== file && 'absolute hidden top-0 left-0 w-full h-full -z-10'
                    )}
                  >
                    <PDFViewer file={file} />
                  </div>
                ))}
              </div>

              {!selectedFile && (
                <div className="flex mx-auto px-2 w-full max-w-96 items-center justify-center h-full w-full">
                  <div
                    className="group cursor-pointer grow"
                    onClick={() => {
                      inputRef.current?.click()
                    }}
                  >
                    {loading ? (
                      <SpinningLoader />
                    ) : (
                      <div className="border-1 p-2 rounded-md border-gray-300">
                        <DropFiles
                          allowMultiple={true}
                          rootClassNames="!text-gray-400 group-hover:text-gray-600 m-auto"
                          showIcon={true}
                          onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            let files = e?.dataTransfer?.items
                            if (!files || files.length === 0) return

                            addFiles(
                              Array.from(files)
                                .map((file) => file.getAsFile())
                                .filter(Boolean) as File[]
                            )
                          }}
                          onFileSelect={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            // @ts-ignore
                            let files = e?.target?.files
                            if (!files || files.length === 0) return

                            addFiles(Array.from(files).filter(Boolean) as File[])
                          }}
                          acceptedFileTypes={['application/pdf']}
                        />
                        <input
                          placeholder="Or paste a URL"
                          className="border-b border-gray-300 w-full text-sm focus:outline-blue-200 py-2"
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        />
                      </div>
                    )}
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
