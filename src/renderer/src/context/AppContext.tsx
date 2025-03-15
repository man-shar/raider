import { ChatManager } from '../components/chat/ChatManager'
import { StatusManager, createStatusManager } from '../components/utils/StatusManager'
import { createContext } from 'react'

export interface AppContextType {
  chatManager: ChatManager
  statusManager: StatusManager
}

export const AppContext = createContext<AppContextType>({
  chatManager: ChatManager(),
  statusManager: createStatusManager()
})
