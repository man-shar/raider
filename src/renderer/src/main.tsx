import './assets/main.css'

import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { RaiderFile } from '@types'

function Startup() {
  const requestSent = useRef(false)
  const [ready, setReady] = useState(false)
  const [openFiles, setOpenFiles] = useState<RaiderFile[]>([])

  useEffect(() => {
    async function init() {
      if (requestSent.current) return
      requestSent.current = true
      const openFiles = await window.fileHandler.getOpenFiles()
      setOpenFiles(openFiles)
      setReady(true)
    }
    init()
  }, [])

  console.log(openFiles)

  return ready ? <App initialFiles={openFiles} /> : null
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Startup />
  </React.StrictMode>
)
