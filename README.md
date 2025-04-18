# Raider

PDF Reader + AI

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ pnpm install
```

### Usage

Create a `.env` file with the following variables:

```
MAIN_VITE_OPENAI_API_KEY="YOUR_OAI_API_KEY"
```

```bash
$ pnpm dev
```

Use the teeny settings icon to add your api keys. I've tested this out with openai, but not with the other providers yet!

### Development

```bash
$ pnpm dev
```

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```
