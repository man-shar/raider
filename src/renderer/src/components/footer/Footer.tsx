import { useContext, useEffect, useState } from 'react'
import { AppContext } from '@renderer/context/AppContext'
import { Task } from '../utils/StatusManager'

export const Footer = () => {
  const { statusManager } = useContext(AppContext)
  const [activeTasks, setActiveTasks] = useState<Task[]>([])

  useEffect(() => {
    const unsubscribe = statusManager.subscribe(() => {
      setActiveTasks(statusManager.getActiveTasks())
    })

    return unsubscribe
  }, [statusManager])

  return (
    <div className="h-9 flex flex-row bg-white border-t border-t-gray-200 text-xs text-gray-500 px-4 py-2">
      {activeTasks.length === 0 ? (
        <span>Ready</span>
      ) : (
        <div className="flex flex-row items-center space-x-4 w-full">
          {activeTasks.map((task) => (
            <div key={task.id} className="flex flex-row items-center">
              <span className="mr-2">{task.label}</span>
              {task.progress !== undefined && (
                <div className="w-24 bg-gray-200 rounded-full h-1.5 mr-2">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              )}
              {task.status === 'running' && task.progress === undefined && (
                <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              )}
            </div>
          ))}
          {activeTasks.length > 0 && (
            <button
              className="ml-auto text-gray-500 hover:text-gray-700"
              onClick={() => statusManager.clearCompletedTasks()}
            >
              Clear completed
            </button>
          )}
        </div>
      )}
    </div>
  )
}
