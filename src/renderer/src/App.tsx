import type { PDFFile } from '@types'
import { PDFViewer } from './components/PDFViewer'
import { useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import { pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'
import { twMerge } from 'tailwind-merge'
import { ChatBar } from './components/ChatBar'
import { Nav } from './components/Nav'
import { SpinningLoader } from '@defogdotai/agents-ui-components/core-ui'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

function App() {
  const [files, setFiles] = useState<PDFFile[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<PDFFile | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setLoading(true)
      // add the uploaded file to the files array
      const files = event.target.files
      if (files) {
        const bufs: Promise<ArrayBuffer>[] = Array.from(files).map((file) => {
          return file.arrayBuffer()
        })

        Promise.all(bufs).then((bufs) => {
          const newFiles: PDFFile[] = bufs.map((buf, i) => {
            return {
              file: files[i],
              buf: buf,
              metadata: {
                name: files[i].name
              }
            }
          })

          setFiles((files) => [...files, ...newFiles])

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
    <div className="prose min-w-screen h-screen relative">
      <input
        type="file"
        multiple
        ref={inputRef}
        className="hidden"
        onChange={onFileChange}
        accept="application/pdf"
      />
      <div className="flex flex-row divide-x divide-gray-200 w-full h-full ">
        {files.length ? (
          <div className="sidebar min-w-96 h-screen bg-white">
            <ChatBar />
          </div>
        ) : null}
        <div className="view-ctr grow overflow-scroll">
          <Nav
            selectedFile={selectedFile}
            files={files}
            setSelectedFile={setSelectedFile}
            addFileClick={() => inputRef.current?.click()}
          />

          <div className="files relative">
            {files.map((file, index) => (
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
            <div className="flex items-center justify-center h-full w-full">
              <div
                className="group cursor-pointer "
                onClick={() => {
                  inputRef.current?.click()
                }}
              >
                {loading ? (
                  <SpinningLoader />
                ) : (
                  <>
                    <FileUp className="w-8 h-8 text-gray-400 group-hover:text-gray-600 m-auto" />
                    <span className="text-gray-600 text-sm font-medium">Open PDFs</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
