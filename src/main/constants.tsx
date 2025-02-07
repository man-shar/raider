import { TiktokenModel } from 'tiktoken'

export const ENCODING_MODEL: TiktokenModel =
  import.meta.env.MAIN_VITE_ENCODING_MODEL || 'text-embedding-3-small'

export const globals: { [key: string]: any } = {}
