// Types for task management
export interface Task {
  id: string
  type: string
  label: string
  progress?: number // 0-100
  status: 'pending' | 'running' | 'completed' | 'error'
  error?: string
  subtasks?: Task[]
  parentId?: string
  createdAt: number
  updatedAt: number
}

type StatusListener = () => void

// Create a StatusManager factory function
export function createStatusManager() {
  // Internal state
  const tasks = new Map<string, Task>()
  const listeners: StatusListener[] = []

  // Function to alert all listeners of changes
  const alertListeners = () => {
    listeners.forEach((listener) => listener())
  }

  // Add a new task
  const addTask = (taskInfo: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    const timestamp = Date.now()
    const task: Task = {
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp,
      ...taskInfo
    }
    tasks.set(task.id, task)
    alertListeners()
    return task.id
  }

  // Update an existing task
  const updateTask = (
    taskId: string,
    updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>
  ) => {
    const task = tasks.get(taskId)
    if (!task) {
      console.error(`Task with ID ${taskId} not found`)
      return false
    }

    const updatedTask = {
      ...task,
      ...updates,
      updatedAt: Date.now()
    }
    tasks.set(taskId, updatedTask)
    alertListeners()
    return true
  }

  // Add a subtask to a parent task
  const addSubtask = (
    parentId: string,
    subtaskInfo: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'parentId'>
  ) => {
    const parent = tasks.get(parentId)
    if (!parent) {
      console.error(`Parent task with ID ${parentId} not found`)
      return null
    }

    // Create the subtask
    const timestamp = Date.now()
    const subtask: Task = {
      id: crypto.randomUUID(),
      parentId,
      status: 'pending',
      createdAt: timestamp,
      updatedAt: timestamp,
      ...subtaskInfo
    }

    // Add subtask to the map
    tasks.set(subtask.id, subtask)

    // Add subtask to parent's subtasks array
    if (!parent.subtasks) {
      parent.subtasks = []
    }
    parent.subtasks.push(subtask)
    parent.updatedAt = timestamp

    alertListeners()
    return subtask.id
  }

  // Remove a task
  const removeTask = (taskId: string) => {
    const task = tasks.get(taskId)
    if (!task) {
      console.error(`Task with ID ${taskId} not found`)
      return false
    }

    // If the task has a parent, remove it from the parent's subtasks
    if (task.parentId) {
      const parent = tasks.get(task.parentId)
      if (parent && parent.subtasks) {
        parent.subtasks = parent.subtasks.filter((subtask) => subtask.id !== taskId)
        parent.updatedAt = Date.now()
      }
    }

    // Remove any subtasks
    if (task.subtasks) {
      task.subtasks.forEach((subtask) => {
        tasks.delete(subtask.id)
      })
    }

    // Remove the task itself
    tasks.delete(taskId)
    alertListeners()
    return true
  }

  // Start a task
  const startTask = (taskId: string) => {
    return updateTask(taskId, { status: 'running' })
  }

  // Complete a task
  const completeTask = (taskId: string) => {
    return updateTask(taskId, { status: 'completed', progress: 100 })
  }

  // Mark a task as error
  const errorTask = (taskId: string, error: string) => {
    return updateTask(taskId, { status: 'error', error })
  }

  // Get active tasks (pending or running)
  const getActiveTasks = (): Task[] => {
    return Array.from(tasks.values()).filter(
      (task) => task.status === 'pending' || task.status === 'running'
    )
  }

  // Get all tasks
  const getAllTasks = (): Task[] => {
    return Array.from(tasks.values())
  }

  // Get task by ID
  const getTask = (taskId: string): Task | undefined => {
    return tasks.get(taskId)
  }

  // Clear completed or error tasks
  const clearCompletedTasks = () => {
    const tasksToRemove: string[] = []
    
    tasks.forEach((task) => {
      if (
        (task.status === 'completed' || task.status === 'error') && 
        !task.parentId // Only remove top-level tasks
      ) {
        tasksToRemove.push(task.id)
      }
    })
    
    tasksToRemove.forEach(removeTask)
    alertListeners()
  }

  // Subscribe to changes
  const subscribe = (listener: StatusListener) => {
    listeners.push(listener)
    return () => {
      const index = listeners.indexOf(listener)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }
  }

  // Return the public API
  return {
    addTask,
    updateTask,
    addSubtask,
    removeTask,
    startTask,
    completeTask,
    errorTask,
    getActiveTasks,
    getAllTasks,
    getTask,
    clearCompletedTasks,
    subscribe
  }
}

// Export a type for the StatusManager
export type StatusManager = ReturnType<typeof createStatusManager>