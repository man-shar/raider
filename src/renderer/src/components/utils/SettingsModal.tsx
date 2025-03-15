import { useContext, useEffect, useState } from 'react'
import { Cog, Eye, EyeOff } from 'lucide-react'
import { Button, Input, SingleSelect, Modal } from '@defogdotai/agents-ui-components/core-ui'
import { AppContext } from '@renderer/context/AppContext'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { apiSettings } = useContext(AppContext)
  const [apiKey, setApiKey] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  // Load settings when modal opens
  useEffect(() => {
    if (isOpen) {
      setApiKey(apiSettings.apiKey || '')
      setSelectedModel(apiSettings.selectedModel || '')

      // Refresh models list if we have an API key
      if (apiSettings.apiKey && apiSettings.models.length === 0) {
        apiSettings.refreshModels()
      }
    }
  }, [isOpen, apiSettings.apiKey, apiSettings.selectedModel])

  const handleSave = async () => {
    // Save API key first, which will trigger a model refresh if changed
    await apiSettings.setApiKey(apiKey)

    // Save selected model
    if (selectedModel) {
      await apiSettings.setModel(selectedModel)
    }

    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)
  }

  const toggleShowApiKey = () => {
    setShowApiKey(!showApiKey)
  }

  return (
    <Modal open={isOpen} onCancel={onClose} title="Settings" footer={false}>
      {apiSettings.error && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md text-sm">
          {apiSettings.error}
        </div>
      )}

      {isSaved && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-md text-sm">
          Settings saved successfully!
        </div>
      )}

      <div className="mb-4 relative">
        <div className="relative">
          <Input
            rootClassNames="grow"
            inputClassNames="pr-8"
            label="OpenAI API Key"
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
          />
          <button
            type="button"
            onClick={toggleShowApiKey}
            className="h-full flex flex-col items-center justify-center absolute top-1/2 -translate-y-1/2 right-1 text-gray-500 hover:text-gray-700"
            aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
          >
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Your API key is stored locally and is never sent to our servers.
        </p>
      </div>

      <div className="mb-6">
        <SingleSelect
          rootClassNames="not-prose"
          label="Model"
          value={selectedModel}
          onChange={setSelectedModel}
          options={apiSettings.models.map((model) => ({
            value: model.id,
            label: model.name
          }))}
          placeholder={
            apiSettings.models.length ? 'Select a model' : 'Enter API key to see available models'
          }
          disabled={!apiKey || apiSettings.models.length === 0}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="secondary" onClick={onClose} disabled={apiSettings.isLoading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={apiSettings.isLoading}>
          {apiSettings.isLoading ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </Modal>
  )
}

export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="p-2 text-xs flex items-center cursor-pointer text-gray-500 hover:text-gray-700"
      title="Settings"
      onClick={onClick}
    >
      <Cog className="w-4 h-4" />
    </button>
  )
}
