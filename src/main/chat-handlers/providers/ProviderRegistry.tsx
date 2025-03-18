import { ProviderConfig, ProviderSettings, ProviderType } from '@types'
import { ProviderInterface } from './BaseProvider'
import { OpenAIProvider } from './OpenAIProvider'
import { AnthropicProvider } from './AnthropicProvider'
import { GoogleProvider } from './GoogleProvider'
import { DeepSeekProvider } from './DeepSeekProvider'
import { 
  saveProviderToDb, 
  getAllProvidersFromDb, 
  getProviderFromDb, 
  updateProviderSettingsInDb,
  saveActiveProviderInDb,
  getActiveProviderFromDb
} from '../../db/providerUtils'

class ProviderRegistry {
  private providers: Map<ProviderType, ProviderInterface> = new Map()
  private activeProviderId: ProviderType = 'openai'
  
  constructor() {
    // Initialize all providers
    this.registerProvider(new OpenAIProvider())
    this.registerProvider(new AnthropicProvider())
    this.registerProvider(new GoogleProvider())
    this.registerProvider(new DeepSeekProvider())
    
    // Load settings from database
    this.loadProvidersFromDb()
  }
  
  // Register a provider
  private registerProvider(provider: ProviderInterface): void {
    this.providers.set(provider.getProviderId(), provider)
  }
  
  // Load provider settings from database
  private loadProvidersFromDb(): void {
    try {
      // Load all providers
      const dbProviders = getAllProvidersFromDb()
      
      if (dbProviders.length > 0) {
        // Update provider settings from DB
        dbProviders.forEach(dbProvider => {
          const provider = this.providers.get(dbProvider.id)
          if (provider) {
            provider.updateSettings(dbProvider.settings)
          }
        })
      } else {
        // No providers in DB yet, save the current ones
        this.providers.forEach(provider => {
          this.saveProviderToDb(provider)
        })
      }
      
      // Load active provider
      const activeProvider = getActiveProviderFromDb()
      if (activeProvider && this.providers.has(activeProvider)) {
        this.activeProviderId = activeProvider
      } else {
        // If no active provider in DB, set default and save it
        saveActiveProviderInDb(this.activeProviderId)
      }
    } catch (error) {
      console.error('Error loading providers from database:', error)
    }
  }
  
  // Save provider to database
  private saveProviderToDb(provider: ProviderInterface): void {
    const config: ProviderConfig = {
      id: provider.getProviderId(),
      name: provider.getProviderName(),
      settings: provider.getSettings(),
      models: []
    }
    
    saveProviderToDb(config)
  }
  
  // Get a provider by ID
  getProvider(providerId: ProviderType): ProviderInterface | undefined {
    return this.providers.get(providerId)
  }
  
  // Get the active provider
  getActiveProvider(): ProviderInterface {
    const provider = this.providers.get(this.activeProviderId)
    if (!provider) {
      // Fallback to OpenAI if active provider is not found
      return this.providers.get('openai')!
    }
    return provider
  }
  
  // Set the active provider
  setActiveProvider(providerId: ProviderType): { success: boolean } {
    if (!this.providers.has(providerId)) {
      return { success: false }
    }
    
    // Set the new active provider
    this.activeProviderId = providerId
    
    // Save to DB
    saveActiveProviderInDb(providerId)
    
    // Ensure settings are properly initialized for this provider
    const provider = this.getProvider(providerId)
    if (provider && !provider.getSettings().apiKey) {
      console.warn(`Warning: Active provider ${providerId} has no API key set`)
    }
    
    return { success: true }
  }
  
  // Get active provider ID
  getActiveProviderId(): ProviderType {
    return this.activeProviderId
  }
  
  // Update provider settings
  async updateProviderSettings(
    providerId: ProviderType,
    settings: Partial<ProviderSettings>
  ): Promise<{ success: boolean }> {
    const provider = this.getProvider(providerId)
    if (!provider) {
      return { success: false }
    }
    
    // Update provider settings in memory
    const result = await provider.updateSettings(settings)
    
    if (result.success) {
      // Save to database
      updateProviderSettingsInDb(providerId, settings)
      
      // Also save the full provider config
      this.saveProviderToDb(provider)
    }
    
    return result
  }
  
  // Get all providers and their settings
  getAllProviders(): ProviderConfig[] {
    const providers: ProviderConfig[] = []
    
    this.providers.forEach(provider => {
      providers.push({
        id: provider.getProviderId(),
        name: provider.getProviderName(),
        settings: provider.getSettings(),
        models: [] // Models will be loaded on demand
      })
    })
    
    return providers
  }
}

// Create and export a singleton instance
export const providerRegistry = new ProviderRegistry()