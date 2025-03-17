import { AIModel, ConversationType, MessageDetails, ProviderSettings, ProviderType } from '@types'
import { BrowserWindow } from 'electron'
import { globals } from '../../constants'
import { addOrUpdateConversationInDb } from '../../db/chatUtils'

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
  startChatCompletion: (details: MessageDetails) => Promise<ConversationType | { error: string }>
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
    this.settings = {
      ...this.settings,
      ...settings
    }
    return { success: true }
  }

  // Model management
  abstract getAvailableModels(): Promise<{ models: AIModel[]; error: string | null }>
  abstract getDefaultModel(): string

  // Chat functionality
  abstract createCompletionStream(messages: any[], model: string): Promise<CompletionStream>

  async startChatCompletion(
    details: MessageDetails
  ): Promise<ConversationType | { error: string }> {
    const { conversation, userInput, highlightedText, file, fileText } = details

    try {
      if (!file) throw new Error('File not found')
      if (!this.settings.apiKey) {
        throw new Error(
          `API key not set for ${this.getProviderName()}. Please configure it in settings.`
        )
      }

      // Prepare the conversation
      const conversationId = conversation?.id || crypto.randomUUID()
      const model = this.settings.selectedModel || this.getDefaultModel()

      // Format and prepare messages using provider-specific logic
      const { initialMessages, newMsgId, terminateString } = await this.prepareMessages(
        conversation,
        userInput,
        highlightedText,
        fileText
      )

      // Create a blank assistant message to show in the UI while streaming
      const blankAssistantMessage = {
        role: 'assistant',
        id: newMsgId,
        isLoading: true,
        content: '',
        highlightedText: null,
        highlightId: null,
        displayContent: '',
        terminateString
      }

      // Create the updated conversation object
      let updatedConversation: ConversationType = conversation
        ? {
            ...conversation,
            messages: initialMessages
          }
        : {
            id: conversationId,
            messages: initialMessages,
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

      // Process the stream
      for await (const chunk of stream) {
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
                ...initialMessages,
                { role: 'assistant', content: fullResponse, id: newMsgId, isLoading: true }
              ]
            }
          })
        }

        i++
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
      addOrUpdateConversationInDb({
        path: file.path,
        is_url: file.is_url,
        name: file.name,
        conversation: {
          ...conversation,
          messages: [
            ...initialMessages,
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
      addOrUpdateConversationInDb({
        path: file.path,
        is_url: file.is_url,
        name: file.name,
        conversation: {
          ...conversation,
          messages: [
            ...initialMessages,
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
  protected abstract prepareMessages(
    conversation: ConversationType | null,
    userInput: string,
    highlightedText: string | null,
    fileText: string | null
  ): Promise<{
    initialMessages: any[]
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
