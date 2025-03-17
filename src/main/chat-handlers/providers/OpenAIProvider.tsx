import { AIModel, ConversationType, ProviderType } from '@types'
import OpenAI from 'openai'
import { BaseProvider, CompletionStream, ProviderCostConfig } from './BaseProvider'
import systemPromptWithHighlight from '../prompts/sys-with-highlight.txt?raw'
import userPromptWithHighlight from '../prompts/user-with-highlight.txt?raw'
import systemPromptWithoutHighlight from '../prompts/sys-without-highlight.txt?raw'
import userPromptWithoutHighlight from '../prompts/user-without-highlight.txt?raw'
import basicSystemPrompt from '../prompts/basic-sys.txt?raw'
import basicUserPrompt from '../prompts/basic-user.txt?raw'

export class OpenAIProvider extends BaseProvider {
  protected costConfig: ProviderCostConfig = {
    'gpt-4o-mini': {
      input: 0.15,
      output: 0.6,
      cachedInput: 0.075
    },
    'gpt-4o': {
      input: 0.5,
      output: 1.5,
      cachedInput: 0.25
    },
    'gpt-4': {
      input: 0.3,
      output: 0.6
    },
    'gpt-3.5-turbo': {
      input: 0.05,
      output: 0.15
    }
  }
  
  // Default model if none is selected
  private readonly DEFAULT_MODEL = 'gpt-4o-mini'
  
  // Provider info
  getProviderId(): ProviderType {
    return 'openai'
  }
  
  getProviderName(): string {
    return 'OpenAI'
  }
  
  getDefaultModel(): string {
    return this.DEFAULT_MODEL
  }
  
  // Create OpenAI client
  private createClient(): OpenAI {
    return new OpenAI({
      apiKey: this.settings.apiKey
    })
  }
  
  // Get available models
  async getAvailableModels(): Promise<{ models: AIModel[], error: string | null }> {
    try {
      if (!this.settings.apiKey) {
        return { models: [], error: 'API key not set' }
      }
      
      const client = this.createClient()
      const response = await client.models.list()
      
      // Filter to include only GPT models
      const chatModels = response.data
        .filter(model => model.id.includes('gpt'))
        .map(model => ({
          id: model.id,
          name: model.id,
          provider: this.getProviderId()
        }))
      
      return { models: chatModels, error: null }
    } catch (error) {
      console.error('Error fetching OpenAI models:', error)
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
      stream: true,
      stream_options: { include_usage: true }
    })
    
    // Create a wrapper around the stream to standardize the format
    const wrappedStream: CompletionStream = {
      next: async () => {
        const { value, done } = await stream[Symbol.asyncIterator]().next()
        
        if (done) {
          return { value: { content: '' }, done: true }
        }
        
        return {
          value: {
            content: value.choices[0]?.delta?.content || '',
            usage: {
              promptTokens: value.usage?.prompt_tokens || 0,
              completionTokens: value.usage?.completion_tokens || 0,
              cachedTokens: value.usage?.prompt_tokens_details?.cached_tokens || 0
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
    // Determine which prompts to use based on context
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

    // Use existing conversation messages or create new ones
    const initialMessages = conversation
      ? conversation.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      : [
          {
            role: 'system',
            content: sysPrompt.trim()
          }
        ]
    
    // Add the new user message
    initialMessages.push({
      role: 'user',
      content: userPrompt.trim()
    })
    
    // Create a unique ID for the message and a terminate string
    const newMsgId = crypto.randomUUID()
    const terminateString = `__TERMINATE_${crypto.randomUUID()}__`
    
    return {
      initialMessages,
      newMsgId,
      terminateString
    }
  }
}