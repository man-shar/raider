import { ProviderType } from '@types'
import { getDb } from '../utils'
import {
  saveProviderToDb,
  getAllProvidersFromDb,
  getProviderFromDb,
  updateProviderSettingsInDb,
  saveActiveProviderInDb,
  getActiveProviderFromDb
} from './providerUtils'

/**
 * Function to test provider database operations
 * This can be called from the main process to verify the functionality
 */
export function testProviderDbOperations(): void {
  console.log('== Testing Provider DB Operations ==')
  
  try {
    // Create test provider
    const testProvider = {
      id: 'openai' as ProviderType,
      name: 'OpenAI',
      settings: {
        apiKey: 'test-api-key',
        selectedModel: 'gpt-4o',
        isEnabled: true
      },
      models: []
    }
    
    // Test saving provider
    console.log('Testing saveProviderToDb...')
    const saveResult = saveProviderToDb(testProvider)
    console.log('Save result:', saveResult)
    
    // Test getting all providers
    console.log('Testing getAllProvidersFromDb...')
    const allProviders = getAllProvidersFromDb()
    console.log('Retrieved providers:', allProviders.length)
    
    // Test getting specific provider
    console.log('Testing getProviderFromDb...')
    const provider = getProviderFromDb('openai')
    console.log('Retrieved provider:', provider?.name)
    
    // Test updating settings
    console.log('Testing updateProviderSettingsInDb...')
    const updateResult = updateProviderSettingsInDb('openai', {
      selectedModel: 'gpt-4o-mini'
    })
    console.log('Update result:', updateResult)
    
    // Test updated provider
    const updatedProvider = getProviderFromDb('openai')
    console.log('Updated model:', updatedProvider?.settings.selectedModel)
    
    // Test active provider
    console.log('Testing active provider functions...')
    saveActiveProviderInDb('anthropic')
    const activeProvider = getActiveProviderFromDb()
    console.log('Active provider:', activeProvider)
    
    console.log('All tests completed successfully')
  } catch (error) {
    console.error('Test failed:', error)
  }
}

/**
 * Function to clear test data
 */
export function cleanupProviderTestData(): void {
  const db = getDb()
  
  try {
    db.prepare('DELETE FROM providers').run()
    console.log('Test data cleaned up')
  } catch (error) {
    console.error('Error cleaning up test data:', error)
  } finally {
    db.close()
  }
}