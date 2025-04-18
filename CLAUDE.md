# CLAUDE.md - Raider Project Guidelines

## Development Commands

- `pnpm run dev`: Start development server with watch mode
- `pnpm run lint`: Run ESLint for code quality
- `pnpm run typecheck`: Run TypeScript type checking
- `pnpm run format`: Format code with Prettier
- `pnpm run build`: Build the application (runs typecheck first)

## Code Style Guidelines

- **Formatting**: Use single quotes, no semicolons, 100 char line limit
- **Imports**: Group imports by source (React, libraries, internal)
- **Types**: Use TypeScript interfaces for component props and state
- **Error Handling**: Use try/catch blocks with error logging and user-facing messages
- **Components**: Use functional components with hooks
- **State Management**: Use React Context for global state
- **File Structure**: Group related components in directories
- **Naming**: Use PascalCase for components, camelCase for variables/functions
- **CSS**: Use Tailwind utility classes with composition via tailwind-merge

## Project Architecture

- Electron app with React frontend
- PDF viewer with highlight capabilities
- Chat interface with OpenAI and Anthropic integration
- Multi-modal support for text and images in chat
- SQLite database for persistence

## UI Components and Libraries

- **Parsed**: Used for Markdown rendering with LaTeX support using katex
- **KaTeX**: Mathematical formula rendering
- **Tailwind**: Utility-first CSS framework
- **PDFPageVirtualizer**: Custom component for efficient PDF rendering with virtualization

## Component Implementation Patterns

- Use debouncing for performance-critical operations (e.g., content updates in Markdown renderer)
- Prefer composition over inheritance
- Implement streaming content with state management for real-time updates

## Content Formatting

- Assistant responses should use Markdown syntax
- LaTeX math expressions use `$...$` for inline and `$$...$$` for block math
- System prompts are configured to encourage Markdown and LaTeX usage

## Implementation Details

- **Streaming Text**: Use state management with React useEffect and useRef for real-time content updates
- **Chat Infrastructure**: Messages flow from OpenAI API → Electron IPC → React components
- **Conditional Rendering**: Only render assistant messages with Markdown, keep user messages as plain text
- **Performance Optimizations**:
  - Debounce content updates in editors to prevent excessive re-rendering
  - Use feature detection to only apply markdown rendering when needed
  - Set explicit keys on list items for better React reconciliation
  - PDF virtualization: Only render visible pages (active ±2) to improve performance
  - Use placeholders with correct dimensions for non-visible PDF pages to maintain scroll position
- **Error Handling**: Gracefully handle streaming failures and incomplete markdown

## API Usage

- The app uses the GPT-4.1-nano model with streaming responses by default
- System prompts contain explicit instructions for response formatting
- Cost tracking is implemented with token counting for both input and output

## Cross-Cutting Concerns

- **IPC Communication**: All Electron-React communication happens via preload scripts
- **Database Access**: Always use the db utility functions to ensure proper error handling
- **CSS Organization**:
  - Component-specific CSS goes in the component files
  - Global styles live in assets/main.css
  - Editor-specific styles are grouped together (e.g., Markdown/LaTeX styles)
- **File Structure**:
  - Main process code in src/main/
  - Renderer process code in src/renderer/
  - Shared types in src/types.ts
  - Electron preload scripts in src/preload/

## Testing Strategy

- Manual testing required for UI components
- Check browser console for errors after implementing new features
- Test with real PDFs to ensure highlighting and conversation features work
- Verify streaming content renders correctly with Markdown and LaTeX
