import { ConversationType, MessageDetails, MessageWithHighlights, RaiderFile } from '@types'
import systemPromptWithHighlight from './prompts/sys-with-highlight.txt?raw'
import userPromptWithHighlight from './prompts/user-with-highlight.txt?raw'
import systemPromptWithoutHighlight from './prompts/sys-without-highlight.txt?raw'
import userPromptWithoutHighlight from './prompts/user-without-highlight.txt?raw'
import basicSystemPrompt from './prompts/basic-sys.txt?raw'
import basicUserPrompt from './prompts/basic-user.txt?raw'
import OpenAI from 'openai'
import { BrowserWindow } from 'electron'
import { DEFAULT_MODEL, globals } from '../constants'
import { addOrUpdateConversationInDb } from '../db/chatUtils'

// Create OpenAI client with a function that dynamically gets the API key
let apiKey = import.meta.env.MAIN_VITE_OPENAI_API_KEY || ''
let selectedModel = DEFAULT_MODEL

export function setApiKey(key: string) {
  apiKey = key
  return { success: true }
}

export function getApiKey() {
  return apiKey
}

export function setModel(model: string) {
  selectedModel = model
  return { success: true }
}

export function getModel() {
  return selectedModel
}

// Function to create a new OpenAI client with the current API key
const createClient = () => {
  return new OpenAI({
    apiKey: apiKey
  })
}

// Get available models from OpenAI
export async function getAvailableModels() {
  try {
    if (!apiKey) {
      return { models: [], error: 'API key not set' }
    }

    const client = createClient()
    const response = await client.models.list()
    
    // Filter to include only chat completion models
    const chatModels = response.data
      .filter(model => model.id.includes('gpt'))
      .map(model => ({
        id: model.id,
        name: model.id
      }))
    
    return { models: chatModels, error: null }
  } catch (error) {
    console.error('Error fetching models:', error)
    return { models: [], error: error.message }
  }
}

const prices = {
  // these are cost in dollars per million tokens
  'gpt-4o-mini': {
    input: 0.15,
    cachedInput: 0.075,
    output: 0.6
  }
}

async function startOaiStream(
  callback: (chunk: string) => void,
  file: RaiderFile,
  newMsgId: string,
  conversation: ConversationType,
  terminateString: string
) {
  const initialMessages = conversation.messages.slice()
  const mainWindowId = parseInt(globals['MAIN_WINDOW_ID']!)
  const mainWindow = BrowserWindow.fromId(mainWindowId)
  
  try {
    const client = createClient()
    const model = selectedModel || DEFAULT_MODEL
    
    const stream = await client.chat.completions.create({
      model: model,
      // @ts-ignore
      messages: initialMessages,
      stream: true,
      stream_options: { include_usage: true }
    })

  let tokens = {
    prompt: 0,
    cachedInput: 0,
    completion: 0
  }

  let i = 0
  let fullResponse = ''

  for await (const chunk of stream) {
    tokens.prompt += chunk.usage?.prompt_tokens || 0

    tokens.cachedInput += chunk.usage?.prompt_tokens_details?.cached_tokens || 0

    tokens.completion += chunk.usage?.completion_tokens || 0

    const chunkContent = chunk.choices[0]?.delta?.content || ''
    callback(chunkContent)

    fullResponse += chunkContent

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

  // Get pricing for the model or use default pricing
  const modelPrices = prices[model] || prices[DEFAULT_MODEL]

  const totalCost =
    ((tokens.prompt - tokens.cachedInput) * modelPrices.input +
      tokens.completion * modelPrices.output +
      tokens.cachedInput * modelPrices.cachedInput) /
    1_000_000

  console.log(`Total cost: $${totalCost}`)

  // Send terminate string as a special chunk to signal completion
  if (mainWindow) {
    mainWindow.webContents.send(newMsgId, terminateString)
  }

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
    console.error('Error in startOaiStream:', error)
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

export function startOaiChat({
  conversation,
  userInput,
  highlightedText,
  highlightId,
  file,
  fileText
}: MessageDetails): ConversationType | { error: string } {
  try {
    if (!file) throw new Error('File not found')
    if (!apiKey) throw new Error('API key not set. Please configure your OpenAI API key in settings.')
    
    // starts a new chat request to openai
    // returns a chat message with an id, and the prompt that was sent
    // streams in the responses as they come in
    // sends updates to the renderer using webcontents.send
    const conversationId = conversation?.id || crypto.randomUUID()

    console.log('userInput received: ', userInput?.slice(0, 100))
    console.log('fileText received: ', fileText?.slice(0, 100))
    console.log('highlightedText received: ', highlightedText?.slice(0, 100))

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

    const initialMessages = conversation
      ? conversation.messages
      : [
          {
            role: 'system',
            id: crypto.randomUUID(),
            content: sysPrompt.trim()
          }
        ]

    const newMsgId = crypto.randomUUID()

    // Create a unique terminate string for this message
    const terminateString = `__TERMINATE_${crypto.randomUUID()}__`
    
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

    const messagesForOpenAi: MessageWithHighlights[] = [
      ...initialMessages,
      {
        role: 'user',
        id: crypto.randomUUID(),
        isLoading: false,
        content: userPrompt.trim(),
        highlightedText: highlightedText,
        highlightId: highlightId,
        displayContent: userInput
      }
    ]

    const mainWindowId = parseInt(globals['MAIN_WINDOW_ID']!)
    const mainWindow = BrowserWindow.fromId(mainWindowId)
    if (!mainWindow) throw new Error('No main window found')
    if (!mainWindowId) throw new Error('No main window id found')

    const model = selectedModel || DEFAULT_MODEL
    
    let updatedConversation: ConversationType = conversation
      ? {
          ...conversation,
          messages: messagesForOpenAi
        }
      : {
          id: conversationId,
          messages: messagesForOpenAi,
          timestamp: new Date().toISOString(),
          metadata: {
            model_name: model
          }
        }

    startOaiStream(
      (chunk) => {
        mainWindow.webContents.send(newMsgId, chunk)
      },
      file,
      newMsgId,
      updatedConversation,
      terminateString
    )

    // now add the blank assistant message to the conversation so the UI renders it and receives updates for it
    updatedConversation = {
      ...updatedConversation,
      messages: [...messagesForOpenAi, blankAssistantMessage]
    }

    addOrUpdateConversationInDb({
      path: file.path,
      is_url: file.is_url,
      name: file.name,
      conversation: updatedConversation
    })

    return updatedConversation
  } catch (error) {
    console.error('Error starting chat:', error)
    return { error: error.message }
  }
}