import { TiktokenModel } from 'tiktoken'

export const ENCODING_MODEL: TiktokenModel =
  import.meta.env.MAIN_VITE_ENCODING_MODEL || 'text-embedding-3-small'

// Default model to use if no model is selected
export const DEFAULT_MODEL = 'gpt-4o-mini'

export const globals: { [key: string]: any } = {}
