/// <reference types="vite/client" />

import { TiktokenModel } from 'tiktoken'

interface ImportMetaEnv {
  readonly MAIN_VITE_ENCODING_MODEL: TiktokenModel
  readonly MAIN_VITE_OPENAI_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
