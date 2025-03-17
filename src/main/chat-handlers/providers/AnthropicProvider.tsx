import { AIModel, ConversationType, ProviderType } from '@types'
import Anthropic from '@anthropic-ai/sdk'
import { BaseProvider, CompletionStream, ProviderCostConfig } from './BaseProvider'
import systemPromptWithHighlight from '../prompts/sys-with-highlight.txt?raw'
import userPromptWithHighlight from '../prompts/user-with-highlight.txt?raw'
import systemPromptWithoutHighlight from '../prompts/sys-without-highlight.txt?raw'
import userPromptWithoutHighlight from '../prompts/user-without-highlight.txt?raw'
import basicSystemPrompt from '../prompts/basic-sys.txt?raw'
import basicUserPrompt from '../prompts/basic-user.txt?raw'

export class AnthropicProvider extends BaseProvider {
  protected costConfig: ProviderCostConfig = {
    'claude-3-opus-20240229': {
      input: 15.0,
      output: 75.0
    },
    'claude-3-sonnet-20240229': {
      input: 3.0,
      output: 15.0
    },
    'claude-3-haiku-20240307': {
      input: 0.25,
      output: 1.25
    },
    'claude-2.1': {
      input: 8.0,
      output: 24.0
    }
  }
  
  // Default model if none is selected
  private readonly DEFAULT_MODEL = 'claude-3-sonnet-20240229'
  
  // Provider info
  getProviderId(): ProviderType {
    return 'anthropic'
  }
  
  getProviderName(): string {
    return 'Anthropic'
  }
  
  getDefaultModel(): string {
    return this.DEFAULT_MODEL
  }
  
  // Create Anthropic client
  private createClient(): Anthropic {
    return new Anthropic({
      apiKey: this.settings.apiKey
    })
  }
  
  // Get available models
  async getAvailableModels(): Promise<{ models: AIModel[], error: string | null }> {
    try {
      if (!this.settings.apiKey) {
        return { models: [], error: 'API key not set' }
      }
      
      // Anthropic doesn't have a list models endpoint so we'll use a static list
      const models: AIModel[] = [
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: this.getProviderId() },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: this.getProviderId() },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: this.getProviderId() },
        { id: 'claude-2.1', name: 'Claude 2.1', provider: this.getProviderId() }
      ]
      
      return { models, error: null }
    } catch (error) {
      console.error('Error with Anthropic models:', error)
      return { models: [], error: error.message }
    }
  }
  
  // Create a stream for the completion
  async createCompletionStream(messages: any[], model: string): Promise<CompletionStream> {
    const client = this.createClient()
    const actualModel = model || this.DEFAULT_MODEL
    
    // Convert messages from OpenAI format to Anthropic format
    const anthropicMessages = this.convertToAnthropicMessages(messages)
    
    // Get system message if it exists
    const systemPrompt = messages.find(m => m.role === 'system')?.content || ''
    
    const stream = await client.messages.create({
      model: actualModel,
      messages: anthropicMessages,
      system: systemPrompt,
      stream: true,
      max_tokens: 4096
    })
    
    // Anthropic doesn't provide token usage in the stream, so we'll estimate
    // Will need to wrap the Anthropic stream to match our CompletionStream interface
    let totalCompletionTokens = 0
    let estimatedPromptTokens = this.estimateTokenCount(
      JSON.stringify(messages)
    )
    
    // Create a wrapper around the stream
    const wrappedStream: CompletionStream = {
      next: async () => {
        try {
          const { value, done } = await stream[Symbol.asyncIterator]().next()
          
          if (done) {
            return { value: { content: '' }, done: true }
          }
          
          // Handle Anthropic stream chunks safely
          // Extract the content from the stream chunk
          let chunkContent = ''
          
          // Try to handle the content based on our best knowledge
          // of Anthropic's streaming format
          if (value && typeof value === 'object') {
            // For Anthropic v2 API
            if ('delta' in value) {
              const delta = value.delta as any
              if (delta && typeof delta === 'object' && 'text' in delta) {
                chunkContent = String(delta.text || '')
              }
            } 
            // For regular content chunks
            else if ('content' in value) {
              chunkContent = String(value.content || '')
            }
          }
          
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
        } catch (error) {
          console.error('Error processing Anthropic stream:', error)
          return { value: { content: '' }, done: true }
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
  
  // Convert OpenAI-style messages to Anthropic format
  private convertToAnthropicMessages(messages: any[]): any[] {
    // Filter out system messages as they're handled separately
    return messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
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
    // Similar to OpenAI but with Anthropic considerations
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

    // For Anthropic, we need to include the system message first
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