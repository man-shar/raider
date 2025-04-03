import './assets/main.css'

import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { RaiderFile } from '@types'
import { PDFManager } from './components/pdf-viewer/PDFManager'

function Startup() {
  const requestSent = useRef(false)
  const [ready, setReady] = useState(false)
  const [openFileManagers, setOpenFileManagers] = useState<PDFManager[]>([])

  useEffect(() => {
    async function init() {
      if (requestSent.current) return
      requestSent.current = true
      const openFiles = await window.fileHandler.getOpenFiles()
      setOpenFileManagers(openFiles.map((d) => PDFManager(d)))
      setReady(true)
    }
    init()
  }, [])

  return ready ? <App initialFileManagers={openFileManagers} /> : null
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Startup />
  </React.StrictMode>
)
