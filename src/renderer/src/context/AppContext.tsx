import { ChatManager } from '../components/chat/ChatManager'
import { StatusManager, createStatusManager } from '../components/utils/StatusManager'
import { createContext, useEffect, useState } from 'react'
import { ProviderConfig, ProviderSettings, ProviderType } from '@types'

export interface AppContextType {
  chatManager: ChatManager
  statusManager: StatusManager
  providerSettings: {
    providers: ProviderConfig[]
    activeProvider: ProviderType
    isLoading: boolean
    error: string | null
    updateProvider: (providerId: ProviderType, settings: Partial<ProviderSettings>) => Promise<void>
    setActiveProvider: (providerId: ProviderType) => Promise<void>
    refreshModels: (providerId: ProviderType) => Promise<void>
    refreshProviders: () => Promise<void>
  }
}

// Create a provider component to handle provider settings
export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [activeProvider, setActiveProviderState] = useState<ProviderType>('openai')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Initialize providers on component mount
  useEffect(() => {
    refreshProviders()
  }, [])
  
  // Refresh the list of providers and their settings
  const refreshProviders = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Get all providers
      const allProviders = await window.chat.getProviders()
      setProviders(allProviders)
      
      // Get active provider
      const active = await window.chat.getActiveProvider()
      setActiveProviderState(active)
      
      // For each provider with an API key, fetch models
      for (const provider of allProviders) {
        if (provider.settings.apiKey) {
          await refreshModels(provider.id)
        }
      }
    } catch (err) {
      setError('Failed to load providers: ' + (err.message || String(err)))
    } finally {
      setIsLoading(false)
    }
  }
  
  // Update a provider's settings
  const updateProvider = async (providerId: ProviderType, settings: Partial<ProviderSettings>) => {
    try {
      setIsLoading(true)
      setError(null)
      
      await window.chat.updateProviderSettings(providerId, settings)
      
      // If the API key changed, refresh models
      if (settings.apiKey !== undefined) {
        await refreshModels(providerId)
      }
      
      // Update the providers list
      await refreshProviders()
    } catch (err) {
      setError('Failed to update provider settings: ' + (err.message || String(err)))
    } finally {
      setIsLoading(false)
    }
  }
  
  // Set the active provider
  const setActiveProvider = async (providerId: ProviderType) => {
    try {
      setIsLoading(true)
      setError(null)
      
      await window.chat.setActiveProvider(providerId)
      setActiveProviderState(providerId)
    } catch (err) {
      setError('Failed to set active provider: ' + (err.message || String(err)))
    } finally {
      setIsLoading(false)
    }
  }
  
  // Refresh the list of models for a provider
  const refreshModels = async (providerId: ProviderType) => {
    try {
      const response = await window.chat.getAvailableModels(providerId)
      
      if (response.error) {
        setError(response.error)
        return
      }
      
      // Update the provider's models
      setProviders(prevProviders => 
        prevProviders.map(provider => {
          if (provider.id === providerId) {
            return {
              ...provider,
              models: response.models
            }
          }
          return provider
        })
      )
    } catch (err) {
      setError('Failed to fetch models: ' + (err.message || String(err)))
    }
  }
  
  const providerSettings = {
    providers,
    activeProvider,
    isLoading,
    error,
    updateProvider,
    setActiveProvider,
    refreshModels,
    refreshProviders
  }
  
  const contextValue: AppContextType = {
    chatManager: ChatManager(),
    statusManager: createStatusManager(),
    providerSettings
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
  providerSettings: {
    providers: [],
    activeProvider: 'openai',
    isLoading: false,
    error: null,
    updateProvider: async () => {},
    setActiveProvider: async () => {},
    refreshModels: async () => {},
    refreshProviders: async () => {}
  }
})