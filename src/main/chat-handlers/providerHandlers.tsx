import { IpcMainInvokeEvent } from 'electron'
import { ProviderSettings, ProviderType } from '@types'
import { 
  getAllProviders, 
  setActiveProvider as setActiveProviderFn, 
  getActiveProvider as getActiveProviderFn,
  updateProviderSettings as updateProviderSettingsFn,
  getAvailableModels as getAvailableModelsFn
} from './providers'

// Get all registered providers
export async function getProviders(
  _event: IpcMainInvokeEvent
) {
  return getAllProviders()
}

// Set the active provider
export async function setActiveProvider(
  _event: IpcMainInvokeEvent,
  providerId: ProviderType
) {
  return setActiveProviderFn(providerId)
}

// Get the active provider
export async function getActiveProvider(
  _event: IpcMainInvokeEvent
) {
  return getActiveProviderFn()
}

// Update provider settings (API key, model, etc.)
export async function updateProviderSettings(
  _event: IpcMainInvokeEvent,
  providerId: ProviderType,
  settings: Partial<ProviderSettings>
) {
  return updateProviderSettingsFn(providerId, settings)
}

// Get available models for a provider
export async function getAvailableModels(
  _event: IpcMainInvokeEvent,
  providerId: ProviderType
) {
  return getAvailableModelsFn(providerId)
}