import { streamText, CoreMessage } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { BrowserWindow } from 'electron'
import {
  AIModel,
  ConversationType,
  NewMessageDetails,
  MessageWithHighlights,
  ProviderSettings,
  ProviderType,
  ProviderConfig as TypesProviderConfig
} from '@types'
import { globals } from '../constants'
import { addOrUpdateConversationInDb, getConversationFromDb } from '../db/chatUtils'
import {
  getAllProvidersFromDb,
  saveProviderToDb,
  updateProviderSettingsInDb,
  getActiveProviderFromDb,
  saveActiveProviderInDb
} from '../db/providerUtils'

// Import prompts
import userPromptWithHighlight from './prompts/user-with-highlight.txt?raw'
import userPromptWithoutHighlight from './prompts/user-without-highlight.txt?raw'
import systemPromptWithHighlightWithFullText from './prompts/sys-with-highlight-with-full-text.txt?raw'
import systemPromptWithoutHighlightWithFullText from './prompts/sys-without-highlight-with-full-text.txt?raw'
import systemPromptWithHighlightWithoutFullText from './prompts/sys-with-highlight-without-full-text.txt?raw'
import systemPromptWithoutHighlightWithoutFullText from './prompts/sys-without-highlight-without-full-text.txt?raw'
import basicSystemPrompt from './prompts/basic-sys.txt?raw'
import basicUserPrompt from './prompts/basic-user.txt?raw'
import formatInstructions from './prompts/format-instructions.txt?raw'
import personalityInstructions from './prompts/personality-instructions.txt?raw'
import userPromptInstructions from './prompts/user-prompt-instructions.txt?raw'

// Internal provider configurations
interface InternalProviderConfig {
  id: ProviderType
  name: string
  defaultModel: string
  costConfig: {
    [modelId: string]: {
      input: number // Cost per 1M tokens
      output: number // Cost per 1M tokens
      cachedInput?: number // Cost per 1M cached tokens
    }
  }
  models: string[]
}

// Provider configurations
export const PROVIDERS: Record<ProviderType, InternalProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    defaultModel: 'gpt-4o',
    costConfig: {
      'gpt-4o': { input: 2.5, output: 10, cachedInput: 1.25 },
      'gpt-4o-mini': { input: 0.15, output: 0.6, cachedInput: 0.075 },
      'gpt-4.1-mini': { input: 0.4, output: 0.6, cachedInput: 0.1 },
      'gpt-4.1-nano': { input: 0.1, output: 0.6, cachedInput: 0.025 }
    },
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1-nano']
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    defaultModel: 'claude-4-sonnet-20250514',
    costConfig: {
      'claude-4-sonnet-20250514': { input: 3.0, output: 15.0, cachedInput: 0.3 }
    },
    models: ['claude-4-sonnet-20250514']
  },
  google: {
    id: 'google',
    name: 'Google',
    defaultModel: 'gemini-2.5-flash',
    costConfig: {
      'gemini-2.5-pro': { input: 1.25, output: 10.0 }, // Using lower tier pricing for simplicity
      'gemini-2.5-flash': { input: 0.15, output: 0.6 }, // Non-thinking output
      'gemini-2.0-flash': { input: 0.1, output: 0.4 }
    },
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash']
  }
}

// Provider settings store
let providerSettings: Record<ProviderType, ProviderSettings> = {
  openai: { apiKey: '', selectedModel: '', isEnabled: true },
  anthropic: { apiKey: '', selectedModel: '', isEnabled: true },
  google: { apiKey: '', selectedModel: '', isEnabled: true }
}

let activeProvider: ProviderType = 'openai'
let isInitialized = false

// Initialize providers from database
function initializeProviders() {
  if (isInitialized) return

  try {
    console.log('Initializing providers from database...')

    // Load providers from database
    const dbProviders = getAllProvidersFromDb()
    console.log(`Loaded ${dbProviders.length} providers from database`)

    // Merge database settings with in-memory settings
    dbProviders.forEach((dbProvider) => {
      if (providerSettings[dbProvider.id]) {
        console.log(`Merging settings for provider: ${dbProvider.id}`)
        providerSettings[dbProvider.id] = {
          ...providerSettings[dbProvider.id],
          ...dbProvider.settings
        }
      }
    })

    // Load active provider from database
    const dbActiveProvider = getActiveProviderFromDb()
    if (dbActiveProvider && PROVIDERS[dbActiveProvider]) {
      console.log(`Setting active provider from database: ${dbActiveProvider}`)
      activeProvider = dbActiveProvider
    } else {
      console.log(`Using default active provider: ${activeProvider}`)
    }

    // If no providers in database, save current defaults
    if (dbProviders.length === 0) {
      console.log('No providers in database, saving defaults...')
      Object.values(PROVIDERS).forEach((config) => {
        const providerConfig: TypesProviderConfig = {
          id: config.id,
          name: config.name,
          settings: providerSettings[config.id],
          models: config.models.map((modelId) => ({
            id: modelId,
            name: modelId,
            provider: config.id
          }))
        }
        saveProviderToDb(providerConfig)
        console.log(`Saved provider to database: ${config.id}`)
      })
      saveActiveProviderInDb(activeProvider)
      console.log(`Saved active provider to database: ${activeProvider}`)
    }

    isInitialized = true
    console.log('Provider initialization complete!')
  } catch (error) {
    console.error('Error initializing providers:', error)
  }
}

// Provider management functions
export function getProviderConfig(providerId: ProviderType): InternalProviderConfig {
  return PROVIDERS[providerId]
}

export function getAllProviders(): TypesProviderConfig[] {
  initializeProviders()

  return Object.values(PROVIDERS).map((config) => ({
    id: config.id,
    name: config.name,
    settings: providerSettings[config.id],
    models: config.models.map((modelId) => ({
      id: modelId,
      name: modelId,
      provider: config.id
    }))
  }))
}

export function getActiveProvider(): ProviderType {
  initializeProviders()
  return activeProvider
}

export function setActiveProvider(providerId: ProviderType): { success: boolean } {
  initializeProviders()

  if (!PROVIDERS[providerId]) {
    return { success: false }
  }

  activeProvider = providerId

  // Save to database
  const saved = saveActiveProviderInDb(providerId)
  if (!saved) {
    console.error('Failed to save active provider to database')
  }

  return { success: true }
}

export function getProviderSettings(providerId: ProviderType): ProviderSettings {
  initializeProviders()
  return providerSettings[providerId]
}

export function updateProviderSettings(
  providerId: ProviderType,
  settings: Partial<ProviderSettings>
): { success: boolean } {
  initializeProviders()

  if (!PROVIDERS[providerId]) {
    return { success: false }
  }

  // Update in-memory settings
  providerSettings[providerId] = {
    ...providerSettings[providerId],
    ...settings
  }

  // Save to database
  const saved = updateProviderSettingsInDb(providerId, settings)
  if (!saved) {
    console.error('Failed to save provider settings to database')
    return { success: false }
  }

  return { success: true }
}

// AI model creation functions
function createOpenAIProvider(apiKey: string) {
  return createOpenAI({ apiKey })
}

function createAnthropicProvider(apiKey: string) {
  return createAnthropic({ apiKey })
}

function createGoogleProvider(apiKey: string) {
  return createGoogleGenerativeAI({ apiKey })
}

// Get available models for a provider
export async function getAvailableModels(
  providerId: ProviderType
): Promise<{ models: AIModel[]; error: string | null }> {
  try {
    initializeProviders()

    const config = PROVIDERS[providerId]
    if (!config) {
      return { models: [], error: 'Provider not found' }
    }

    const models = config.models.map((modelId) => ({
      id: modelId,
      name: modelId,
      provider: providerId
    }))

    return { models, error: null }
  } catch (error) {
    console.error(`Error fetching ${providerId} models:`, error)
    return { models: [], error: error.message }
  }
}

// Calculate cost
function calculateCost(
  providerId: ProviderType,
  model: string,
  promptTokens: number,
  completionTokens: number,
  cachedTokens: number = 0
): number {
  const config = PROVIDERS[providerId]
  const modelCost = config.costConfig[model] || Object.values(config.costConfig)[0]

  console.log(modelCost, cachedTokens, promptTokens, completionTokens)

  const cost =
    (promptTokens * modelCost.input +
      completionTokens * modelCost.output +
      cachedTokens * (modelCost.cachedInput || 0)) /
    1_000_000

  return cost
}

// Message preparation function
function prepareMessages({
  conversation,
  userInput,
  highlightedText,
  highlightId,
  highlightedPageNumber,
  fileText,
  pageWiseText,
  fileTokenLength,
  images
}: {
  conversation: ConversationType | null
  userInput: string
  highlightedText: string | null
  highlightId: string | null
  highlightedPageNumber: number | null
  fileText: string | null
  pageWiseText: { [pageNumber: number]: string } | null
  fileTokenLength: number
  images?: { id: string; base64: string; loading: boolean }[]
}): {
  initialMessages: MessageWithHighlights[]
  newMsgId: string
  terminateString: string
} {
  // Prepare context text chunks
  let sysPrompt: string
  let userPrompt: string
  let first10PagesText: string = ''
  let highlightPageText: string = ''
  let beforeHighlight: string = ''
  let afterHighlight: string = ''

  if (pageWiseText) {
    first10PagesText = Array.from({ length: 10 })
      .map((_, idx) => pageWiseText[idx + 1])
      .filter(Boolean)
      .join('\n')

    if (highlightedPageNumber) {
      highlightPageText = pageWiseText[highlightedPageNumber] || ''

      beforeHighlight = Array.from({ length: 5 })
        .map((_, idx) => {
          const targetPageNum = highlightedPageNumber - idx - 1
          return targetPageNum > 1 ? pageWiseText[targetPageNum] : null
        })
        .filter(Boolean)
        .join('\n')

      afterHighlight = Array.from({ length: 5 })
        .map((_, idx) => {
          const targetPageNum = highlightedPageNumber + idx + 1
          return pageWiseText[targetPageNum] || null
        })
        .filter(Boolean)
        .join('\n')
    }
  }

  const isTooBig = fileTokenLength >= 50_000
  const numPages = Object.keys(pageWiseText || {}).length.toString()

  // Choose appropriate prompts
  if (highlightedText && fileText) {
    if (!isTooBig) {
      sysPrompt = systemPromptWithHighlightWithFullText.replaceAll('{fileText}', fileText)
    } else {
      sysPrompt = systemPromptWithHighlightWithoutFullText
        .replace('{fileTextFirst10Pages}', first10PagesText)
        .replace('{beforeHighlight}', beforeHighlight)
        .replace('{afterHighlight}', afterHighlight)
        .replace('{pageNumber}', numPages)
        .replace('{highlightPageText}', highlightPageText)
    }
    userPrompt = userPromptWithHighlight
      .replaceAll('{userInput}', userInput)
      .replaceAll('{highlightedText}', highlightedText)
  } else if (fileText && !highlightedText) {
    if (!isTooBig) {
      sysPrompt = systemPromptWithoutHighlightWithFullText.replaceAll('{fileText}', fileText)
    } else {
      sysPrompt = systemPromptWithoutHighlightWithoutFullText
        .replace('{fileTextFirst10Pages}', first10PagesText)
        .replace('{beforeHighlight}', beforeHighlight)
        .replace('{pageNumber}', numPages)
        .replace('{afterHighlight}', afterHighlight)
        .replace('{highlightPageText}', highlightPageText)
    }
    userPrompt = userPromptWithoutHighlight.replaceAll('{userInput}', userInput)
  } else {
    sysPrompt = basicSystemPrompt
    userPrompt = basicUserPrompt.replaceAll('{userInput}', userInput)
  }

  // Apply format and personality instructions
  sysPrompt = sysPrompt
    .replace('{formatInstructions}', formatInstructions)
    .replace('{personalityInstructions}', personalityInstructions)
    .trim()

  userPrompt = userPrompt.replace('{userPromptInstructions}', userPromptInstructions).trim()

  const systemMessage: MessageWithHighlights = {
    id: crypto.randomUUID(),
    role: 'system',
    content: sysPrompt
  }

  // Build initialMessages (full message objects for storage)
  const initialMessages: MessageWithHighlights[] = [
    systemMessage,
    ...(conversation ? conversation.messages : [])
  ]

  // Prepare the new user message with full details
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
        // @ts-ignore
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

  const newMsgId = crypto.randomUUID()
  const terminateString = `__TERMINATE_${crypto.randomUUID()}__`

  return { initialMessages, newMsgId, terminateString }
}

// Main chat completion function
export async function startChatCompletion(
  details: NewMessageDetails
): Promise<ConversationType | { error: string }> {
  const { userInput, highlightedText, highlightId, highlightedPageNumber, file, images } = details

  try {
    if (!file) throw new Error('File not found')

    initializeProviders()

    const config = PROVIDERS[activeProvider]
    const settings = providerSettings[activeProvider]

    if (!settings.apiKey) {
      throw new Error(`API key not set for ${config.name}. Please configure it in settings.`)
    }

    // Get conversation if exists
    let conversation: ConversationType | null = null
    let conversationId: string

    if (details.conversationId) {
      conversationId = details.conversationId
      const { error, conversation: fetched } = getConversationFromDb({
        path: file.path,
        is_url: file.is_url,
        name: file.name,
        conversationId: details.conversationId
      })

      if (error || !fetched) {
        throw new Error(error || 'Could not fetch conversation')
      }
      conversation = fetched
    } else {
      conversationId = crypto.randomUUID()
    }

    const model = settings.selectedModel || config.defaultModel
    const fileText = file?.details?.fullText
    const pageWiseText = file?.details?.pageWiseText
    const fileTokenLength = file?.details.fileTokenLength || 0

    // Prepare messages
    const { initialMessages, newMsgId, terminateString } = prepareMessages({
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

    // Create blank assistant message for UI
    const blankAssistantMessage: MessageWithHighlights = {
      role: 'assistant',
      id: newMsgId,
      isLoading: true,
      content: '',
      highlightedText: null,
      highlightId: null,
      terminateString
    }

    // Create updated conversation
    let updatedConversation: ConversationType = conversation
      ? {
          ...conversation,
          // Remove the system message to save storage
          messages: initialMessages.slice(1)
        }
      : {
          id: conversationId,
          // Remove the system message to save storage
          messages: initialMessages.slice(1),
          timestamp: new Date().toISOString(),
          metadata: {
            model_name: model,
            provider: activeProvider
          }
        }

    // Convert to API messages for streaming (filter out error messages)
    const apiMessages: CoreMessage[] = initialMessages
      .filter((msg) => msg.role !== 'error') // Filter out error messages - AI SDK doesn't support this role
      .map((msg) => ({
        role: msg.role,
        content:
          typeof msg.content === 'string'
            ? msg.content
            : msg.content.map((part) => {
                if (part.type === 'image_url') {
                  return { type: 'image', image: part.image_url.url }
                } else if (part.type === 'text') {
                  return { type: 'text', text: part.text }
                } else {
                  return { type: 'image', image: part.source.data }
                }
              })
      }))

    // Start streaming
    streamChatCompletion(
      apiMessages,
      model,
      newMsgId,
      file,
      updatedConversation,
      terminateString,
      userInput
    )

    // Add blank message for UI
    updatedConversation = {
      ...updatedConversation,
      messages: [...updatedConversation.messages, blankAssistantMessage]
    }

    // Save conversation
    addOrUpdateConversationInDb({
      path: file.path,
      is_url: file.is_url,
      name: file.name,
      conversation: updatedConversation
    })

    return updatedConversation
  } catch (error) {
    console.error(`Error starting chat with ${activeProvider}:`, error)
    return { error: error.message }
  }
}

// Stream chat completion function
async function streamChatCompletion(
  messages: CoreMessage[],
  model: string,
  newMsgId: string,
  file: any,
  conversation: ConversationType,
  terminateString: string,
  userInput?: string
): Promise<void> {
  initializeProviders()

  const config = PROVIDERS[activeProvider]
  const settings = providerSettings[activeProvider]
  const mainWindowId = parseInt(globals['MAIN_WINDOW_ID']!)
  const mainWindow = BrowserWindow.fromId(mainWindowId)

  try {
    // Create AI provider and model based on provider
    let providerInstance: any
    switch (activeProvider) {
      case 'openai':
        providerInstance = createOpenAIProvider(settings.apiKey)
        break
      case 'anthropic':
        providerInstance = createAnthropicProvider(settings.apiKey)
        break
      case 'google':
        providerInstance = createGoogleProvider(settings.apiKey)
        break
      default:
        throw new Error(`Unsupported provider: ${activeProvider}`)
    }

    // Start streaming
    const result = streamText({
      model: providerInstance(model),
      messages,
      maxTokens: 4096,
      onError: (e) => {
        // @ts-ignore
        throw new Error(e.error.message || 'Error calling the API')
      }
    })

    let tokens = {
      prompt: 0,
      cachedInput: 0,
      completion: 0
    }

    let fullResponse = ''
    let i = 0

    // Process stream
    for await (const delta of result.textStream) {
      // Send chunk to UI
      if (mainWindow) {
        mainWindow.webContents.send(newMsgId, delta)
      }

      fullResponse += delta

      // Periodically update conversation in DB
      if (i % 100 === 0) {
        addOrUpdateConversationInDb({
          path: file.path,
          is_url: file.is_url,
          name: file.name,
          conversation: {
            ...conversation,
            messages: [
              ...conversation.messages,
              { role: 'assistant', content: fullResponse, id: newMsgId, isLoading: true }
            ]
          }
        })
      }
      i++
    }

    // Get final usage
    const usage = await result.usage
    if (usage) {
      tokens.prompt = usage.promptTokens
      tokens.completion = usage.completionTokens
      // AI SDK doesn't expose cached tokens yet, so we'll set to 0
      tokens.cachedInput = 0
    }

    // Calculate cost
    const totalCost = calculateCost(
      activeProvider,
      model,
      tokens.prompt,
      tokens.completion,
      tokens.cachedInput
    )

    console.log(`Total cost: $${totalCost}`)

    // Send terminate signal
    if (mainWindow) {
      mainWindow.webContents.send(newMsgId, terminateString)
    }

    // Final conversation update
    addOrUpdateConversationInDb({
      path: file.path,
      is_url: file.is_url,
      name: file.name,
      conversation: {
        ...conversation,
        messages: [
          ...conversation.messages,
          { role: 'assistant', content: fullResponse, id: newMsgId, isLoading: false }
        ],
        tokens,
        totalCost: conversation.totalCost ? conversation.totalCost + totalCost : totalCost
      }
    })
  } catch (error) {
    console.error(`Error in ${activeProvider} stream:`, error)

    // Send error signal to UI
    if (mainWindow) {
      mainWindow.webContents.send(`${newMsgId}:error`, {
        message: error.message,
        canResend: true,
        originalMessage: userInput || ''
      })
      mainWindow.webContents.send(newMsgId, terminateString)
    }

    // Save error message to conversation
    addOrUpdateConversationInDb({
      path: file.path,
      is_url: file.is_url,
      name: file.name,
      conversation: {
        ...conversation,
        messages: [
          ...conversation.messages,
          {
            role: 'error',
            content: '',
            id: newMsgId,
            isLoading: false,
            error: {
              message: error.message,
              canResend: true,
              originalMessage: userInput || ''
            }
          }
        ]
      }
    })
  }
}

// Resend message function
export async function resendMessage(
  details: NewMessageDetails,
  failedMessageId: string
): Promise<ConversationType | { error: string }> {
  const {
    userInput,
    highlightedText,
    highlightId,
    highlightedPageNumber,
    file,
    images,
    conversationId
  } = details

  try {
    if (!file || !conversationId) throw new Error('File and conversation ID required for resending')

    initializeProviders()

    const config = PROVIDERS[activeProvider]
    const settings = providerSettings[activeProvider]

    if (!settings.apiKey) {
      throw new Error(`API key not set for ${config.name}. Please configure it in settings.`)
    }

    // Get existing conversation
    const { error, conversation: existingConversation } = getConversationFromDb({
      path: file.path,
      is_url: file.is_url,
      name: file.name,
      conversationId
    })

    if (error || !existingConversation) {
      throw new Error(error || 'Could not fetch conversation for resend')
    }

    const model = settings.selectedModel || config.defaultModel
    const fileText = file?.details?.fullText
    const pageWiseText = file?.details?.pageWiseText
    const fileTokenLength = file?.details.fileTokenLength || 0

    // Add the resent user message to the conversation
    const newUserMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userInput,
      displayContent: userInput,
      highlightedText,
      highlightId
    }

    const updatedConversation = {
      ...existingConversation,
      messages: [...existingConversation.messages, newUserMessage]
    }

    // Prepare messages for the API (this will include all previous messages + the new one)
    const { initialMessages, newMsgId, terminateString } = prepareMessages({
      conversation: updatedConversation,
      userInput,
      highlightedText,
      highlightId,
      highlightedPageNumber,
      fileText,
      fileTokenLength,
      pageWiseText,
      images
    })

    // Create blank assistant message for UI
    const blankAssistantMessage = {
      role: 'assistant',
      id: newMsgId,
      isLoading: true,
      content: '',
      highlightedText: null,
      highlightId: null,
      terminateString
    }

    // Convert to API messages for streaming (filter out error messages)
    const apiMessages: CoreMessage[] = initialMessages
      .filter((msg) => msg.role !== 'error') // Filter out error messages - AI SDK doesn't support this role
      .map((msg) => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content:
          msg.role === 'system' || msg.role === 'assistant'
            ? msg.content
            : typeof msg.content === 'string'
              ? msg.content
              : msg.content.map((part) => {
                  if (part.type === 'image_url') {
                    return { type: 'image', image: part.image_url.url }
                  } else if (part.type === 'text') {
                    return { type: 'text', text: part.text }
                  } else {
                    return { type: 'image', image: part.source.data }
                  }
                })
      }))

    // Start streaming with updated conversation
    streamChatCompletion(
      apiMessages,
      model,
      newMsgId,
      file,
      updatedConversation,
      terminateString,
      userInput
    )

    // Add blank message for UI and save
    const finalConversation = {
      ...updatedConversation,
      messages: [...updatedConversation.messages, blankAssistantMessage]
    }

    addOrUpdateConversationInDb({
      path: file.path,
      is_url: file.is_url,
      name: file.name,
      conversation: finalConversation
    })

    return finalConversation
  } catch (error) {
    console.error(`Error resending message:`, error)
    return { error: error.message }
  }
}
