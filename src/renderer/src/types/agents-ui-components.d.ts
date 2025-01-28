declare module '@defogdotai/agents-ui-components' {
  export interface InputProps extends React.ComponentPropsWithoutRef<'input'> {
    value?: string
    defaultValue?: string
    label?: string | React.ReactNode
    type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url'
    status?: 'error'
    disabled?: boolean
    rootClassNames?: string
    placeholder?: string
    id?: string
    name?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    onPressEnter?: (e: React.KeyboardEvent<HTMLInputElement>) => void
    inputHtmlProps?: React.InputHTMLAttributes<HTMLInputElement>
    inputClassNames?: string
    size?: 'default' | 'small'
  }

  export const Input: React.FC<InputProps>
}
