import { ProviderConfig, ProviderSettings, ProviderType } from '@types'
import { ProviderInterface } from './BaseProvider'
import { OpenAIProvider } from './OpenAIProvider'
import { AnthropicProvider } from './AnthropicProvider'
import { GoogleProvider } from './GoogleProvider'
import { DeepSeekProvider } from './DeepSeekProvider'

class ProviderRegistry {
  private providers: Map<ProviderType, ProviderInterface> = new Map()
  private activeProviderId: ProviderType = 'openai'
  
  constructor() {
    // Initialize all providers
    this.registerProvider(new OpenAIProvider())
    this.registerProvider(new AnthropicProvider())
    this.registerProvider(new GoogleProvider())
    this.registerProvider(new DeepSeekProvider())
  }
  
  // Register a provider
  private registerProvider(provider: ProviderInterface): void {
    this.providers.set(provider.getProviderId(), provider)
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
    
    return provider.updateSettings(settings)
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