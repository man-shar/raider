import { IpcMainInvokeEvent } from 'electron'
import { ProviderSettings, ProviderType } from '@types'
import { providerRegistry } from './providers/ProviderRegistry'

// Get all registered providers
export async function getProviders(
  _event: IpcMainInvokeEvent
) {
  return providerRegistry.getAllProviders()
}

// Set the active provider
export async function setActiveProvider(
  _event: IpcMainInvokeEvent,
  providerId: ProviderType
) {
  return providerRegistry.setActiveProvider(providerId)
}

// Get the active provider
export async function getActiveProvider(
  _event: IpcMainInvokeEvent
) {
  return providerRegistry.getActiveProviderId()
}

// Update provider settings (API key, model, etc.)
export async function updateProviderSettings(
  _event: IpcMainInvokeEvent,
  providerId: ProviderType,
  settings: Partial<ProviderSettings>
) {
  return providerRegistry.updateProviderSettings(providerId, settings)
}

// Get available models for a provider
export async function getAvailableModels(
  _event: IpcMainInvokeEvent,
  providerId: ProviderType
) {
  const provider = providerRegistry.getProvider(providerId)
  if (!provider) {
    return { models: [], error: `Provider ${providerId} not found` }
  }
  
  return provider.getAvailableModels()
}