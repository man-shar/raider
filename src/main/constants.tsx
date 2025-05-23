import { Tiktoken } from 'tiktoken/lite'
import model from 'tiktoken/encoders/cl100k_base.json'

// Default model to use if no model is selected
export const DEFAULT_MODEL = 'gpt-4o-mini'

export const globals: { [key: string]: any } = {}

export const tokenizer = new Tiktoken(model.bpe_ranks, model.special_tokens, model.pat_str)
