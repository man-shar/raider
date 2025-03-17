import { IpcMainInvokeEvent } from 'electron'
import { ConversationType, MessageDetails, ProviderType } from '@types'
import { providerRegistry } from './providers/ProviderRegistry'

export default async function sendChatMessage(
  _event: IpcMainInvokeEvent,
  details: MessageDetails
): Promise<ConversationType | { error: string }> {
  try {
    // Determine which provider to use
    const providerId = details.providerId || providerRegistry.getActiveProviderId()
    const provider = providerRegistry.getProvider(providerId as ProviderType)
    
    if (!provider) {
      return { error: `Provider ${providerId} not found` }
    }
    
    // Check if the provider has an API key set
    if (!provider.getSettings().apiKey) {
      return { error: `Please set an API key for ${provider.getProviderName()} in settings` }
    }
    
    // Start the chat with the selected provider
    return provider.startChatCompletion(details)
  } catch (error) {
    console.error('Error in sendChatMessage:', error)
    return { error: error.message }
  }
}