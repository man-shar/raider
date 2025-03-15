import { ChatManager } from '../components/chat/ChatManager'
import { StatusManager, createStatusManager } from '../components/utils/StatusManager'
import { createContext, useEffect, useState } from 'react'
import { OpenAIModel } from '@types'

export interface AppContextType {
  chatManager: ChatManager
  statusManager: StatusManager
  apiSettings: {
    apiKey: string
    selectedModel: string
    models: OpenAIModel[]
    isLoading: boolean
    error: string | null
    setApiKey: (key: string) => Promise<void>
    setModel: (model: string) => Promise<void>
    refreshModels: () => Promise<void>
  }
}

// Create a provider component to handle API settings state
export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState('')
  const [selectedModel, setSelectedModelState] = useState('')
  const [models, setModels] = useState<OpenAIModel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Initialize with values from main process
  useEffect(() => {
    const initSettings = async () => {
      try {
        const storedApiKey = await window.chat.getApiKey()
        if (storedApiKey) {
          setApiKeyState(storedApiKey)
          
          const storedModel = await window.chat.getModel()
          setSelectedModelState(storedModel)
          
          // Fetch available models if we have an API key
          await refreshModels()
        }
      } catch (err) {
        console.error('Failed to initialize API settings:', err)
      }
    }
    
    initSettings()
  }, [])
  
  const setApiKey = async (key: string) => {
    try {
      setIsLoading(true)
      await window.chat.setApiKey(key)
      setApiKeyState(key)
      
      // Refresh models when API key changes
      if (key) {
        await refreshModels()
      } else {
        setModels([])
      }
    } catch (err) {
      setError('Failed to set API key: ' + (err.message || String(err)))
    } finally {
      setIsLoading(false)
    }
  }
  
  const setModel = async (model: string) => {
    try {
      setIsLoading(true)
      await window.chat.setModel(model)
      setSelectedModelState(model)
    } catch (err) {
      setError('Failed to set model: ' + (err.message || String(err)))
    } finally {
      setIsLoading(false)
    }
  }
  
  const refreshModels = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await window.chat.getAvailableModels()
      if (response.error) {
        setError(response.error)
      } else {
        setModels(response.models || [])
      }
    } catch (err) {
      setError('Failed to fetch models: ' + (err.message || String(err)))
      setModels([])
    } finally {
      setIsLoading(false)
    }
  }
  
  const apiSettings = {
    apiKey,
    selectedModel,
    models,
    isLoading,
    error,
    setApiKey,
    setModel,
    refreshModels
  }
  
  const contextValue: AppContextType = {
    chatManager: ChatManager(),
    statusManager: createStatusManager(),
    apiSettings
  }
  
  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  )
}

// Create the context with default values
export const AppContext = createContext<AppContextType>({
  chatManager: ChatManager(),
  statusManager: createStatusManager(),
  apiSettings: {
    apiKey: '',
    selectedModel: '',
    models: [],
    isLoading: false,
    error: null,
    setApiKey: async () => {},
    setModel: async () => {},
    refreshModels: async () => {}
  }
})
