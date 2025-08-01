# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `pnpm dev` - Start development server with Turbo
- `pnpm build` - Build for production (includes database migration)
- `pnpm start` - Start production server

### Code Quality
- `pnpm lint` - Run Next.js ESLint and Biome linter with auto-fix
- `pnpm lint:fix` - Run linters with fixes
- `pnpm format` - Format code with Biome

### Database Operations
- `pnpm db:generate` - Generate Drizzle migrations
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm db:push` - Push schema changes to database

### Testing
- `pnpm test` - Run Playwright e2e tests
- Tests are organized in `/tests` with separate `e2e/` and `routes/` suites

## Architecture

### Core Technologies
- **Next.js 15** with App Router and React Server Components
- **AI SDK** for LLM integration with Azure OpenAI (GPT-4o) as default model
- **Drizzle ORM** with PostgreSQL (Neon Serverless)
- **Auth.js** for authentication
- **Biome** for linting and formatting
- **Playwright** for testing

### Directory Structure
- `/app/(auth)/` - Authentication routes and components
- `/app/(chat)/` - Main chat interface and API routes
- `/components/` - React components including shadcn/ui components
- `/lib/ai/` - AI model configuration, providers, and tools
- `/lib/db/` - Database schema, queries, and migrations
- `/artifacts/` - Artifact handling (code, image, sheet, text)
- `/hooks/` - Custom React hooks
- `/tests/` - E2E and route testing

### Key Features
- Multi-modal chat with artifact generation (code, images, sheets, text)
- File upload and document processing
- Real-time streaming responses
- Chat history with public/private visibility
- User authentication and session management

### Database Schema
- Users, chats, messages with artifact support
- Deprecated `Message` table being migrated to `Message_v2`
- Vote tracking for message feedback

### AI Integration
- Azure OpenAI integration through AI SDK
- Models: GPT-4.1 (chat, titles, artifacts), DALL-E 3 (images)
- Tool calling for document creation, weather, suggestions
- Streaming responses with artifact generation
- Model selection between chat and reasoning models

### Development Notes
- Uses pnpm as package manager
- Biome configuration in `biome.jsonc` with custom rules
- Environment variables required (see `.env.example`)
- Docker Compose available for local development
- Turbo mode enabled for faster development builds