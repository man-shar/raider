import { AIModel, ConversationType, MessageWithHighlights, ProviderType } from '@types'
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

  // Default model if none is selected (must support vision for images)
  private readonly DEFAULT_MODEL = 'gpt-4o'

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
  async getAvailableModels(): Promise<{ models: AIModel[]; error: string | null }> {
    try {
      if (!this.settings.apiKey) {
        return { models: [], error: 'API key not set' }
      }

      const client = this.createClient()
      const response = await client.models.list()

      // Filter to include only GPT models
      const chatModels = response.data
        .filter((model) => model.id.includes('gpt'))
        .map((model) => ({
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
    let actualModel = model || this.DEFAULT_MODEL

    // Check if any message contains images
    const hasImages = messages.some(
      (msg) => Array.isArray(msg.content) && msg.content.some((item) => item.type === 'image_url')
    )

    // If images are present, ensure we use a vision-capable model
    if (hasImages) {
      // Only gpt-4o and gpt-4-vision support images
      if (!actualModel.includes('gpt-4o') && !actualModel.includes('gpt-4-vision')) {
        console.log(
          `Model ${actualModel} doesn't support vision. Switching to gpt-4o for image support.`
        )
        actualModel = 'gpt-4o'
      }
    }

    const response = await client.chat.completions.create({
      model: actualModel,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 4096 // Set reasonable token limit
    })

    // Store iterator state to avoid consuming stream multiple times
    let streamIterator = response[Symbol.asyncIterator]()
    let lastIterResult: any = null

    // Create a wrapper around the stream to standardize the format
    const wrappedStream: CompletionStream = {
      next: async () => {
        try {
          // Get the next chunk from the stream
          const iterResult = await streamIterator.next()
          lastIterResult = iterResult

          if (iterResult.done) {
            return { value: { content: '' }, done: true }
          }

          const value = iterResult.value

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
        } catch (error) {
          console.error('Error in OpenAI stream iterator:', error)
          // Return an empty result on error, allowing the stream to continue
          return { value: { content: '' }, done: lastIterResult?.done || false }
        }
      },
      [Symbol.asyncIterator]: function () {
        // Return a proper async iterator that uses our stored state
        return {
          next: this.next
        } as AsyncIterator<any>
      }
    }

    return wrappedStream
  }

  // Prepare messages with appropriate prompts
  async prepareMessages(
    conversation: ConversationType,
    userInput: string,
    highlightedText: string | null,
    highlightId: string | null,
    fileText: string | null,
    images?: { id: string; base64: string; loading: boolean }[]
  ): Promise<{
    initialMessages: MessageWithHighlights[]
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

    const systemMessage = {
      id: crypto.randomUUID(),
      role: 'system',
      content: sysPrompt.trim()
    }

    // Use existing conversation messages or create new ones
    const initialMessages = [systemMessage, ...(conversation ? conversation.messages : [])]

    // Prepare the user message
    if (images && images.length > 0) {
      // Use content array format for multimodal messages with images
      const userMessage: MessageWithHighlights = {
        id: crypto.randomUUID(),
        role: 'user',
        displayContent: userInput,
        highlightedText,
        highlightId,
        content: [
          { type: 'text', text: userPrompt.trim() },
          // Add images as additional content items
          ...images.map((img) => ({
            type: 'image_url',
            image_url: {
              url: img.base64,
              detail: 'high'
            }
          }))
        ]
      }

      initialMessages.push(userMessage)
    } else {
      // Simple text-only message
      initialMessages.push({
        id: crypto.randomUUID(),
        role: 'user',
        highlightedText,
        highlightId,
        content: userPrompt.trim(),
        displayContent: userInput
      })
    }

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
