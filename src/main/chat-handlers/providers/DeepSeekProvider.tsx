import { AIModel, ConversationType, ProviderType } from '@types'
import OpenAI from 'openai'
import { BaseProvider, CompletionStream, ProviderCostConfig } from './BaseProvider'
import systemPromptWithHighlight from '../prompts/sys-with-highlight.txt?raw'
import userPromptWithHighlight from '../prompts/user-with-highlight.txt?raw'
import systemPromptWithoutHighlight from '../prompts/sys-without-highlight.txt?raw'
import userPromptWithoutHighlight from '../prompts/user-without-highlight.txt?raw'
import basicSystemPrompt from '../prompts/basic-sys.txt?raw'
import basicUserPrompt from '../prompts/basic-user.txt?raw'

export class DeepSeekProvider extends BaseProvider {
  protected costConfig: ProviderCostConfig = {
    'deepseek-chat': {
      input: 0.05,
      output: 0.25
    },
    'deepseek-coder': {
      input: 0.05,
      output: 0.25
    }
  }
  
  // Default model if none is selected
  private readonly DEFAULT_MODEL = 'deepseek-chat'
  
  // DeepSeek API base URL
  private readonly API_BASE = 'https://api.deepseek.com/v1'
  
  // Provider info
  getProviderId(): ProviderType {
    return 'deepseek'
  }
  
  getProviderName(): string {
    return 'DeepSeek'
  }
  
  getDefaultModel(): string {
    return this.DEFAULT_MODEL
  }
  
  // Create OpenAI-compatible client for DeepSeek
  private createClient(): OpenAI {
    return new OpenAI({
      apiKey: this.settings.apiKey,
      baseURL: this.API_BASE
    })
  }
  
  // Get available models
  async getAvailableModels(): Promise<{ models: AIModel[], error: string | null }> {
    try {
      if (!this.settings.apiKey) {
        return { models: [], error: 'API key not set' }
      }
      
      // DeepSeek doesn't have a list models endpoint, so we'll define the models
      const models: AIModel[] = [
        { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: this.getProviderId() },
        { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: this.getProviderId() }
      ]
      
      return { models, error: null }
    } catch (error) {
      console.error('Error with DeepSeek models:', error)
      return { models: [], error: error.message }
    }
  }
  
  // Create a stream for the completion
  async createCompletionStream(messages: any[], model: string): Promise<CompletionStream> {
    const client = this.createClient()
    const actualModel = model || this.DEFAULT_MODEL
    
    const stream = await client.chat.completions.create({
      model: actualModel,
      messages,
      stream: true
    })
    
    // DeepSeek doesn't provide token usage in the stream response
    // We'll need to estimate it
    let totalCompletionTokens = 0
    const estimatedPromptTokens = this.estimateTokenCount(
      JSON.stringify(messages)
    )
    
    // Create a wrapper around the stream
    const wrappedStream: CompletionStream = {
      next: async () => {
        const { value, done } = await stream[Symbol.asyncIterator]().next()
        
        if (done) {
          return { value: { content: '' }, done: true }
        }
        
        // Extract the text from the chunk
        const chunkContent = value.choices[0]?.delta?.content || ''
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
    // Similar approach to OpenAI provider
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