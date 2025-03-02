import { ChatManager } from '../components/chat/ChatManager'
import { createContext } from 'react'

export interface AppContextType {
  chatManager: ChatManager
}

export const AppContext = createContext<AppContextType>({
  chatManager: ChatManager()
})
