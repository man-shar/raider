import { AIModel, ConversationType, ProviderType } from '@types'
import { BaseProvider, CompletionStream, ProviderCostConfig } from './BaseProvider'
import systemPromptWithHighlight from '../prompts/sys-with-highlight.txt?raw'
import userPromptWithHighlight from '../prompts/user-with-highlight.txt?raw'
import systemPromptWithoutHighlight from '../prompts/sys-without-highlight.txt?raw'
import userPromptWithoutHighlight from '../prompts/user-without-highlight.txt?raw'
import basicSystemPrompt from '../prompts/basic-sys.txt?raw'
import basicUserPrompt from '../prompts/basic-user.txt?raw'
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai'

export class GoogleProvider extends BaseProvider {
  protected costConfig: ProviderCostConfig = {
    'gemini-1.5-pro': {
      input: 0.01,
      output: 0.03
    },
    'gemini-1.5-flash': {
      input: 0.002,
      output: 0.006
    },
    'gemini-pro': {
      input: 0.002,
      output: 0.006
    }
  }
  
  // Default model if none is selected
  private readonly DEFAULT_MODEL = 'gemini-1.5-pro'
  
  // Provider info
  getProviderId(): ProviderType {
    return 'google'
  }
  
  getProviderName(): string {
    return 'Google'
  }
  
  getDefaultModel(): string {
    return this.DEFAULT_MODEL
  }
  
  // Create Google client
  private createClient(): GoogleGenerativeAI {
    return new GoogleGenerativeAI(this.settings.apiKey)
  }
  
  // Get available models
  async getAvailableModels(): Promise<{ models: AIModel[], error: string | null }> {
    try {
      if (!this.settings.apiKey) {
        return { models: [], error: 'API key not set' }
      }
      
      // Google doesn't have a list models endpoint, so we'll define the models
      const models: AIModel[] = [
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: this.getProviderId() },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: this.getProviderId() },
        { id: 'gemini-pro', name: 'Gemini Pro', provider: this.getProviderId() }
      ]
      
      return { models, error: null }
    } catch (error) {
      console.error('Error with Google models:', error)
      return { models: [], error: error.message }
    }
  }
  
  // Create a model instance for a specific model
  private getModel(modelName: string): GenerativeModel {
    const client = this.createClient()
    return client.getGenerativeModel({ model: modelName })
  }
  
  // Create a stream for the completion
  async createCompletionStream(messages: any[], model: string): Promise<CompletionStream> {
    const actualModel = model || this.DEFAULT_MODEL
    const geminiModel = this.getModel(actualModel)
    
    // Convert messages from OpenAI format to Gemini format
    const geminiMessages = this.convertToGeminiMessages(messages)
    
    // Start the chat and generate a streaming response
    const chat = geminiModel.startChat({
      history: geminiMessages.slice(0, -1) // All except the last message
    })
    
    const lastUserMessage = geminiMessages[geminiMessages.length - 1].parts[0]
    const result = await chat.sendMessageStream(lastUserMessage)
    
    // Estimate token counts - Google doesn't provide token counts in the API
    const estimatedPromptTokens = this.estimateTokenCount(
      JSON.stringify(geminiMessages)
    )
    let totalCompletionTokens = 0
    
    // Create a wrapper around the stream
    const wrappedStream: CompletionStream = {
      next: async () => {
        const { value, done } = await result[Symbol.asyncIterator]().next()
        
        if (done) {
          return { value: { content: '' }, done: true }
        }
        
        // Extract the text from the chunk
        const chunkContent = value.text || ''
        const chunkTokens = this.estimateTokenCount(chunkContent)
        totalCompletionTokens += chunkTokens
        
        return {
          value: {
            content: chunkContent,
            usage: {
              promptTokens: estimatedPromptTokens,
              completionTokens: chunkTokens
            }
          },
          done: false
        }
      },
      [Symbol.asyncIterator]: function() {
        const iterator = {
          next: this.next
        }
        return iterator as AsyncIterator<any>
      }
    }
    
    return wrappedStream
  }
  
  // Convert OpenAI-style messages to Gemini format
  private convertToGeminiMessages(messages: any[]): any[] {
    return messages.map(msg => ({
      role: msg.role === 'system' ? 'user' : msg.role,
      parts: [{ text: msg.content }]
    }))
  }
  
  // Simple token count estimation (rough approximation)
  private estimateTokenCount(text: string): number {
    // Rough approximation: 1 token ~= 4 characters
    return Math.ceil(text.length / 4)
  }
  
  // Prepare messages with appropriate prompts
  async prepareMessages(
    conversation: ConversationType | null,
    userInput: string,
    highlightedText: string | null,
    fileText: string | null
  ): Promise<{
    initialMessages: any[]
    newMsgId: string
    terminateString: string
  }> {
    // Similar approach to other providers
    let sysPrompt: string
    let userPrompt: string

    if (highlightedText && fileText) {
      sysPrompt = systemPromptWithHighlight.replaceAll('{fileText}', fileText)
      userPrompt = userPromptWithHighlight
        .replaceAll('{userInput}', userInput)
        .replaceAll('{highlightedText}', highlightedText)
        .trim()
    } else if (fileText && !highlightedText) {
      sysPrompt = systemPromptWithoutHighlight.replaceAll('{fileText}', fileText)
      userPrompt = userPromptWithoutHighlight.replaceAll('{userInput}', userInput).trim()
    } else {
      sysPrompt = basicSystemPrompt
      userPrompt = basicUserPrompt.replaceAll('{userInput}', userInput).trim()
    }

    let initialMessages = conversation 
      ? [...conversation.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))]
      : [{ 
          role: 'system', 
          content: sysPrompt.trim() 
        }]
    
    // Add user message
    initialMessages.push({
      role: 'user',
      content: userPrompt.trim()
    })

    const newMsgId = crypto.randomUUID()
    const terminateString = `__TERMINATE_${crypto.randomUUID()}__`
    
    return {
      initialMessages,
      newMsgId,
      terminateString
    }
  }
}