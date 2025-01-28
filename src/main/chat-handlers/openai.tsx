import { ChatMessageType, MessageDetails } from '@types'
import systemPrompt from './prompts/basic-sys.txt?raw'
import userPrompt from './prompts/basic-user.txt?raw'
import OpenAI from 'openai'
import { BrowserWindow } from 'electron'

const client = new OpenAI({
  apiKey: process.env['MAIN_VITE_OPENAI_API_KEY'] // This is the default and can be omitted
})

async function startOaiStream(callback: (chunk: string) => void, messages) {
  const stream = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messages,
    stream: true
  })
  for await (const chunk of stream) {
    callback(chunk.choices[0]?.delta?.content || '')
  }
}

export function startOaiChat({ userInput, highlightedText }: MessageDetails): ChatMessageType {
  // starts a new chat request to openai
  // returns a chat message with an id, and the prompt that was sent
  // streams in the responses as they come in
  // sends updates to the renderer using webcontents.send
  const id = crypto.randomUUID()

  const messages = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: userPrompt
        .replace('{userInput}', userInput)
        .replace('{highlightedText}', highlightedText)
    }
  ]
  const mainWindowId = parseInt(process.env['MAIN_WINDOW_ID']!)
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
