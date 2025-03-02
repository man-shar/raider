import { ChatMessageType, MessageDetails } from '@types'
import systemPromptWithHighlight from './prompts/sys-with-highlight.txt?raw'
import userPromptWithHighlight from './prompts/user-with-highlight.txt?raw'
import systemPromptWithoutHighlight from './prompts/sys-without-highlight.txt?raw'
import userPromptWithoutHighlight from './prompts/user-without-highlight.txt?raw'
import basicSystemPrompt from './prompts/basic-sys.txt?raw'
import basicUserPrompt from './prompts/basic-user.txt?raw'
import OpenAI from 'openai'
import { BrowserWindow } from 'electron'
import { globals } from '../constants'

const client = new OpenAI({
  apiKey: import.meta.env.MAIN_VITE_OPENAI_API_KEY // This is the default and can be omitted
})

const prices = {
  // these are cost in dollars per million tokens
  'gpt-4o-mini': {
    input: 0.15,
    cachedInput: 0.075,
    output: 0.6
  }
}

const model = 'gpt-4o-mini'

async function startOaiStream(callback: (chunk: string) => void, messages) {
  const stream = await client.chat.completions.create({
    model: model,
    messages: messages,
    stream: true,
    stream_options: { include_usage: true }
  })
  let tokens = {
    prompt: 0,
    cachedInput: 0,
    completion: 0
  }
  for await (const chunk of stream) {
    tokens.prompt += chunk.usage?.prompt_tokens || 0

    tokens.cachedInput += chunk.usage?.prompt_tokens_details?.cached_tokens || 0

    tokens.completion += chunk.usage?.completion_tokens || 0

    callback(chunk.choices[0]?.delta?.content || '')
  }

  console.log(tokens)

  const totalCost =
    (tokens.prompt - tokens.cachedInput) * prices[model].input +
    tokens.completion * prices[model].output +
    tokens.cachedInput * prices[model].cachedInput

  console.log(`Total cost: $${totalCost / 1_000_000}`)
}

export function startOaiChat({
  userInput,
  highlightedText,
  fileText
}: MessageDetails): ChatMessageType {
  // starts a new chat request to openai
  // returns a chat message with an id, and the prompt that was sent
  // streams in the responses as they come in
  // sends updates to the renderer using webcontents.send
  const id = crypto.randomUUID()

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

  const messages = [
    {
      role: 'system',
      content: sysPrompt.trim()
    },
    {
      role: 'user',
      content: userPrompt.trim()
    }
  ]

  const mainWindowId = parseInt(globals['MAIN_WINDOW_ID']!)
  const mainWindow = BrowserWindow.fromId(mainWindowId)
  if (!mainWindow) throw new Error('No main window found')
  if (!mainWindowId) throw new Error('No main window id found')

  startOaiStream((chunk) => {
    mainWindow.webContents.send(id, chunk)
  }, messages)

  return {
    id,
    userInput,
    highlightedText,
    messages,
    timestamp: new Date().toISOString(),
    response: `This was the question: ${userInput}`,
    metadata: {
      model_name: 'gpt-4o-mini'
    }
  }
}
