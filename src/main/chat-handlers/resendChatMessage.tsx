import { IpcMainInvokeEvent } from 'electron'
import { ConversationType, NewMessageDetails, ProviderType } from '@types'
import { resendMessage, getActiveProvider, getProviderSettings, getProviderConfig } from './providers'

export default async function resendChatMessage(
  _event: IpcMainInvokeEvent,
  details: NewMessageDetails,
  failedMessageId: string
): Promise<ConversationType | { error: string }> {
  try {
    // Determine which provider to use
    const providerId = (details.providerId as ProviderType) || getActiveProvider()
    const settings = getProviderSettings(providerId)
    const config = getProviderConfig(providerId)

    if (!config) {
      return { error: `Provider ${providerId} not found` }
    }

    // Check if the provider has an API key set
    if (!settings.apiKey) {
      return { error: `Please set an API key for ${config.name} in settings` }
    }

    // Resend the message
    return resendMessage(details, failedMessageId)
  } catch (error) {
    console.error('Error in resendChatMessage:', error)
    return { error: error.message }
  }
}