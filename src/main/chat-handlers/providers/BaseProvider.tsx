import {
  AIModel,
  ConversationType,
  NewMessageDetails,
  MessageWithHighlights,
  ProviderSettings,
  ProviderType
} from '@types'
import { BrowserWindow } from 'electron'
import { globals } from '../../constants'
import { addOrUpdateConversationInDb, getConversationFromDb } from '../../db/chatUtils'

export interface ProviderCostConfig {
  [modelId: string]: {
    input: number // Cost per 1M tokens
    output: number // Cost per 1M tokens
    cachedInput?: number // Cost per 1M cached tokens (if applicable)
  }
}

export interface StreamChunk {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    cachedTokens?: number
  }
}

export interface CompletionStream {
  next: () => Promise<{ value: StreamChunk; done: boolean }>
  [Symbol.asyncIterator]: () => AsyncIterator<StreamChunk>
}

export interface ProviderInterface {
  // Provider info
  getProviderId: () => ProviderType
  getProviderName: () => string

  // Settings management
  getSettings: () => ProviderSettings
  updateSettings: (settings: Partial<ProviderSettings>) => Promise<{ success: boolean }>

  // Model management
  getAvailableModels: () => Promise<{ models: AIModel[]; error: string | null }>
  getDefaultModel: () => string

  // Chat functionality
  startChatCompletion: (details: NewMessageDetails) => Promise<ConversationType | { error: string }>
  createCompletionStream: (messages: any[], model: string) => Promise<CompletionStream>

  // Cost calculation
  calculateCost: (
    promptTokens: number,
    completionTokens: number,
    cachedTokens: number,
    model: string
  ) => number
}

export abstract class BaseProvider implements ProviderInterface {
  protected settings: ProviderSettings = {
    apiKey: '',
    selectedModel: '',
    isEnabled: true
  }

  protected abstract costConfig: ProviderCostConfig

  // Provider info
  abstract getProviderId(): ProviderType
  abstract getProviderName(): string

  // Settings management
  getSettings(): ProviderSettings {
    return this.settings
  }

  async updateSettings(settings: Partial<ProviderSettings>): Promise<{ success: boolean }> {
    // Apply the new settings
    this.settings = {
      ...this.settings,
      ...settings
    }

    // Validate API key if provided
    if (settings.apiKey !== undefined) {
      try {
        // You could add validation for API keys here if needed
        // For example, making a test request to validate the key
        console.log(`Updated API key for ${this.getProviderName()}`)
      } catch (error) {
        console.error(`Error validating API key for ${this.getProviderName()}:`, error)
        // Still allow the update even if validation fails
      }
    }

    return { success: true }
  }

  // Model management
  abstract getAvailableModels(): Promise<{ models: AIModel[]; error: string | null }>
  abstract getDefaultModel(): string

  // Chat functionality
  abstract createCompletionStream(messages: any[], model: string): Promise<CompletionStream>

  async startChatCompletion(
    details: NewMessageDetails
  ): Promise<ConversationType | { error: string }> {
    const { userInput, highlightedText, highlightId, highlightedPageNumber, file, images } = details

    const fileText = file?.details?.fullText
    const pageWiseText = file?.details?.pageWiseText
    const fileTokenLength = file?.details.fileTokenLength

    try {
      if (!file) throw new Error('File not found')

      if (!this.settings.apiKey) {
        throw new Error(
          `API key not set for ${this.getProviderName()}. Please configure it in settings.`
        )
      }

      // get the conversation using the id
      let conversation: ConversationType | null = null
      let conversationId: string | null = null

      if (details.conversationId) {
        conversationId = details.conversationId

        const { error, conversation: fetched } = getConversationFromDb({
          path: file.path,
          is_url: file.is_url,
          name: file.name,
          conversationId: details.conversationId
        })

        if (error || !fetched) {
          throw error || 'Could not fetch conversation'
        }

        conversation = fetched
      } else {
        conversation = null
        conversationId = crypto.randomUUID()
      }

      // Prepare the conversation
      const model = this.settings.selectedModel || this.getDefaultModel()

      // Format and prepare messages using provider-specific logic
      const { initialMessages, newMsgId, terminateString } = await this.prepareMessages({
        conversation,
        userInput,
        highlightedText,
        highlightId,
        highlightedPageNumber,
        fileText,
        fileTokenLength,
        pageWiseText,
        images
      })

      console.log(
        'Message roles:',
        initialMessages.map((d) => d.role)
      )

      // Create a blank assistant message to show in the UI while streaming
      const blankAssistantMessage = {
        role: 'assistant',
        id: newMsgId,
        isLoading: true,
        content: '',
        highlightedText: null,
        highlightId: null,
        terminateString
      }

      // Create the updated conversation object
      let updatedConversation: ConversationType = conversation
        ? {
            ...conversation,
            // remove the system message to save storage
            messages: initialMessages.slice(1)
          }
        : {
            id: conversationId,
            // remove the system message to save storage
            messages: initialMessages.slice(1),
            timestamp: new Date().toISOString(),
            metadata: {
              model_name: model,
              provider: this.getProviderId()
            }
          }

      // Start streaming the response
      this.startStream(initialMessages, model, newMsgId, file, updatedConversation, terminateString)

      // Add the blank assistant message to the conversation for rendering
      updatedConversation = {
        ...updatedConversation,
        messages: [...updatedConversation.messages, blankAssistantMessage]
      }

      // Store the conversation in the database
      addOrUpdateConversationInDb({
        path: file.path,
        is_url: file.is_url,
        name: file.name,
        conversation: updatedConversation
      })

      return updatedConversation
    } catch (error) {
      console.error(`Error starting chat with ${this.getProviderName()}:`, error)
      return { error: error.message }
    }
  }

  async startStream(
    messages: any[],
    model: string,
    newMsgId: string,
    file: any,
    conversation: ConversationType,
    terminateString: string
  ): Promise<void> {
    const initialMessages = [...messages]
    const mainWindowId = parseInt(globals['MAIN_WINDOW_ID']!)
    const mainWindow = BrowserWindow.fromId(mainWindowId)

    try {
      // Create the completion stream
      const stream = await this.createCompletionStream(messages, model)

      let tokens = {
        prompt: 0,
        cachedInput: 0,
        completion: 0
      }

      let i = 0
      let fullResponse = ''

      // Process the stream using manual iteration to better handle errors
      let done = false
      while (!done) {
        try {
          const { value: chunk, done: streamDone } = await stream.next()
          done = streamDone

          if (streamDone) break
          // Update token counts
          tokens.prompt += chunk.usage?.promptTokens || 0
          tokens.cachedInput += chunk.usage?.cachedTokens || 0
          tokens.completion += chunk.usage?.completionTokens || 0

          // Send content to the UI
          const chunkContent = chunk.content || ''
          if (mainWindow) {
            mainWindow.webContents.send(newMsgId, chunkContent)
          }

          // Update the full response
          fullResponse += chunkContent

          // Periodically update the conversation in the database
          if (i % 100 === 0) {
            addOrUpdateConversationInDb({
              path: file.path,
              is_url: file.is_url,
              name: file.name,
              conversation: {
                ...conversation,
                messages: [
                  // remove system message to save storage
                  ...initialMessages.slice(1),
                  { role: 'assistant', content: fullResponse, id: newMsgId, isLoading: true }
                ]
              }
            })
          }

          i++
        } catch (streamError) {
          console.error(`Error iterating stream:`, streamError)
          done = true
          // Only break the loop, don't rethrow if it's just a consumed stream error
          if (streamError.message && !streamError.message.includes('consumed stream')) {
            throw streamError
          }
        }
      }

      // Calculate total cost
      const totalCost = this.calculateCost(
        tokens.prompt - tokens.cachedInput,
        tokens.completion,
        tokens.cachedInput,
        model
      )

      console.log(`Total cost: $${totalCost}`)

      // Send terminate string to signal completion
      if (mainWindow) {
        mainWindow.webContents.send(newMsgId, terminateString)
      }

      // Update the conversation with the final response
      // Don't double-stringify content that might already be stringified
      const normalizedMessages = initialMessages.map((msg) => {
        // If it's already a string, keep it as is
        if (typeof msg.content === 'string') {
          return msg
        }

        // For object content, store it directly in the message
        // The database serialization will handle this properly
        return {
          ...msg,
          content: msg.content
        }
      })

      addOrUpdateConversationInDb({
        path: file.path,
        is_url: file.is_url,
        name: file.name,
        conversation: {
          ...conversation,
          messages: [
            // remove system message to save storage
            ...normalizedMessages.slice(1),
            { role: 'assistant', content: fullResponse, id: newMsgId, isLoading: false }
          ],
          tokens,
          totalCost: conversation.totalCost ? conversation.totalCost + totalCost : totalCost
        }
      })
    } catch (error) {
      console.error(`Error in ${this.getProviderName()} stream:`, error)

      // Send error message followed by terminate string
      if (mainWindow) {
        mainWindow.webContents.send(newMsgId, `\n\nError: ${error.message}`)
        mainWindow.webContents.send(newMsgId, terminateString)
      }

      // Add error message to conversation
      // Don't double-stringify message content
      const normalizedMessages = initialMessages.map((msg) => {
        // If it's already a string, keep it as is
        if (typeof msg.content === 'string') {
          return msg
        }

        // For object content, store it directly without additional stringifying
        return {
          ...msg,
          content: msg.content
        }
      })

      addOrUpdateConversationInDb({
        path: file.path,
        is_url: file.is_url,
        name: file.name,
        conversation: {
          ...conversation,
          messages: [
            // remove system message to save storage
            ...normalizedMessages.slice(1),
            {
              role: 'assistant',
              content: `Error: ${error.message}`,
              id: newMsgId,
              isLoading: false
            }
          ]
        }
      })
    }
  }

  // Helper method to prepare messages for the API
  protected abstract prepareMessages(opts: {
    conversation: ConversationType | null
    userInput: string
    highlightedText: string | null
    highlightId: string | null
    highlightedPageNumber: number | null
    fileText: string | null
    fileTokenLength: number
    pageWiseText: { [pageNumber: number]: string }
    images: { id: string; base64: string; loading: boolean }[]
  }): Promise<{
    initialMessages: MessageWithHighlights[]
    newMsgId: string
    terminateString: string
  }>

  // Calculate cost based on token usage
  calculateCost(
    promptTokens: number,
    completionTokens: number,
    cachedTokens: number,
    model: string
  ): number {
    // Get the cost config for the model
    const modelCost = this.costConfig[model] || Object.values(this.costConfig)[0]

    // Calculate the cost
    const cost =
      (promptTokens * modelCost.input +
        completionTokens * modelCost.output +
        cachedTokens * (modelCost.cachedInput || 0)) /
      1_000_000

    return cost
  }
}
