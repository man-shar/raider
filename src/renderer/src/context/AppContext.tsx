import { ChatManager } from '@renderer/components/ChatManager'
import { createContext } from 'react'

export interface AppContextType {
  chatManager: ChatManager
}

export const AppContext = createContext<AppContextType>({
  chatManager: ChatManager()
})
