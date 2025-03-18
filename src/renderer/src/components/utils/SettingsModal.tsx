import { useContext, useEffect, useState } from 'react'
import { Cog, Eye, EyeOff } from 'lucide-react'
import { Button, Input, SingleSelect, Modal } from '@defogdotai/agents-ui-components/core-ui'
import { AppContext } from '@renderer/context/AppContext'
import { ProviderType } from '@types'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { providerSettings } = useContext(AppContext)
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('openai')
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [selectedModel, setSelectedModel] = useState('')

  // Load settings when modal opens
  useEffect(() => {
    if (isOpen) {
      // Set active provider
      const activeProvider = providerSettings.activeProvider
      setSelectedProvider(activeProvider)

      // Load provider settings
      const provider = providerSettings.providers.find((p) => p.id === activeProvider)
      if (provider) {
        setApiKey(provider.settings.apiKey || '')
        setSelectedModel(provider.settings.selectedModel || '')
      }

      // Refresh providers if needed
      if (providerSettings.providers.length === 0) {
        providerSettings.refreshProviders()
      }
    }
  }, [isOpen, providerSettings.providers, providerSettings.activeProvider])

  // When selected provider changes, update the form values
  useEffect(() => {
    const provider = providerSettings.providers.find((p) => p.id === selectedProvider)
    if (provider) {
      setApiKey(provider.settings.apiKey || '')
      setSelectedModel(provider.settings.selectedModel || '')
      setShowApiKey(false) // Reset show API key when provider changes
    }
  }, [selectedProvider, providerSettings.providers])

  const toggleShowApiKey = () => {
    setShowApiKey((prev) => !prev)
  }

  const handleSave = async () => {
    try {
      // Update the selected provider's settings
      await providerSettings.updateProvider(selectedProvider, {
        apiKey,
        selectedModel,
        isEnabled: true
      })

      // Set the active provider
      await providerSettings.setActiveProvider(selectedProvider)
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  // Get models for the selected provider
  const getModelsForProvider = (providerId: ProviderType) => {
    const provider = providerSettings.providers.find((p) => p.id === providerId)
    return provider?.models || []
  }

  // Create provider options for select
  const providerOptions = providerSettings.providers.map((provider) => ({
    value: provider.id,
    label: provider.name
  }))

  // Get current provider
  const currentProvider = providerSettings.providers.find((p) => p.id === selectedProvider)
  const models = getModelsForProvider(selectedProvider)

  return (
    <Modal open={isOpen} onCancel={onClose} title="Settings" footer={false}>
      {providerSettings.error && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md text-sm">
          {providerSettings.error}
        </div>
      )}

      <div className="mb-6">
        <SingleSelect
          rootClassNames="not-prose mb-6"
          label="AI Provider"
          value={selectedProvider}
          onChange={setSelectedProvider}
          options={providerOptions}
          placeholder="Select an AI provider"
        />

        {currentProvider && (
          <>
            <div className="mb-4 relative">
              <div className="relative">
                <Input
                  rootClassNames="grow"
                  inputClassNames="pr-8"
                  label={`${currentProvider.name} API Key`}
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter API key..."
                />
                <button
                  type="button"
                  onClick={toggleShowApiKey}
                  className="absolute right-1 cursor-pointer bottom-3 text-gray-500 hover:text-gray-700"
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
                options={models.map((model) => ({
                  value: model.id,
                  label: model.name
                }))}
                placeholder={
                  models.length ? 'Select a model' : 'Enter API key to see available models'
                }
                disabled={!apiKey || models.length === 0}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end space-x-2 mt-6">
        <Button variant="secondary" onClick={onClose} disabled={providerSettings.isLoading}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={providerSettings.isLoading}>
          {providerSettings.isLoading ? 'Saving...' : 'Save'}
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
