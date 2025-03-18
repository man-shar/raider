import { ProviderConfig, ProviderConfigDbRow, ProviderSettings, ProviderType } from '@types'
import { getDb } from '../utils'

/**
 * Saves provider settings to the database
 */
export function saveProviderToDb(provider: ProviderConfig): boolean {
  const db = getDb()

  try {
    const { id, name, settings } = provider

    // Convert settings object to JSON string
    const settingsJson = JSON.stringify(settings)

    // Use REPLACE to handle both insert and update
    const stmt = db.prepare(`
      REPLACE INTO providers (id, name, settings, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `)

    stmt.run(id, name, settingsJson)
    return true
  } catch (error) {
    console.error('Error saving provider to database:', error)
    return false
  } finally {
    db.close()
  }
}

/**
 * Retrieves all providers from the database
 */
export function getAllProvidersFromDb(): ProviderConfig[] {
  const db = getDb()

  try {
    const stmt = db.prepare<[], ProviderConfigDbRow>('SELECT id, name, settings FROM providers')
    const rows = stmt.all()

    return rows.map((row) => ({
      id: row.id as ProviderType,
      name: row.name,
      settings: JSON.parse(row.settings),
      models: [] // Models will be loaded on demand
    }))
  } catch (error) {
    console.error('Error retrieving providers from database:', error)
    return []
  } finally {
    db.close()
  }
}

/**
 * Retrieves a specific provider from the database
 */
export function getProviderFromDb(providerId: ProviderType): ProviderConfig | null {
  const db = getDb()

  try {
    const stmt = db.prepare<[ProviderType], ProviderConfigDbRow>(
      'SELECT id, name, settings FROM providers WHERE id = ?'
    )
    const row = stmt.get(providerId)

    if (!row) return null

    return {
      id: row.id as ProviderType,
      name: row.name,
      settings: JSON.parse(row.settings),
      models: [] // Models will be loaded on demand
    }
  } catch (error) {
    console.error(`Error retrieving provider ${providerId} from database:`, error)
    return null
  } finally {
    db.close()
  }
}

/**
 * Updates settings for a specific provider
 */
export function updateProviderSettingsInDb(
  providerId: ProviderType,
  settings: Partial<ProviderSettings>
): boolean {
  const db = getDb()

  try {
    // First get the current settings
    const stmt = db.prepare<[ProviderType], ProviderConfigDbRow>(
      'SELECT settings FROM providers WHERE id = ?'
    )
    const row = stmt.get(providerId)

    if (!row) return false

    // Merge current settings with new settings
    const currentSettings = JSON.parse(row.settings)
    const updatedSettings = {
      ...currentSettings,
      ...settings
    }

    // Update the provider record
    const updateStmt = db.prepare(`
      UPDATE providers 
      SET settings = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)

    updateStmt.run(JSON.stringify(updatedSettings), providerId)
    return true
  } catch (error) {
    console.error(`Error updating provider ${providerId} settings:`, error)
    return false
  } finally {
    db.close()
  }
}

/**
 * Saves the active provider ID to the database
 */
export function saveActiveProviderInDb(providerId: ProviderType): boolean {
  const db = getDb()

  try {
    // We'll use a special record with id 'active' to store the active provider
    const stmt = db.prepare(`
      REPLACE INTO providers (id, name, settings, updated_at)
      VALUES ('active', 'Active Provider', ?, CURRENT_TIMESTAMP)
    `)

    stmt.run(JSON.stringify({ activeProviderId: providerId }))
    return true
  } catch (error) {
    console.error('Error saving active provider to database:', error)
    return false
  } finally {
    db.close()
  }
}

/**
 * Retrieves the active provider ID from the database
 */
export function getActiveProviderFromDb(): ProviderType | null {
  const db = getDb()

  try {
    const stmt = db.prepare<[], ProviderConfigDbRow>(
      "SELECT settings FROM providers WHERE id = 'active'"
    )
    const row = stmt.get()

    if (!row) return null

    const settings = JSON.parse(row.settings)
    return settings.activeProviderId as ProviderType
  } catch (error) {
    console.error('Error retrieving active provider from database:', error)
    return null
  } finally {
    db.close()
  }
}
