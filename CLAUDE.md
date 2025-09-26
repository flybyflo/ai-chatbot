# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `pnpm dev` - Start development server with Turbo
- `pnpm build` - Build production application (includes database migration)
- `pnpm start` - Start production server
- `pnpm lint` - Check code quality using Ultracite
- `pnpm format` - Auto-fix code formatting using Ultracite
- `pnpm test` - Run Playwright tests

### Database Operations
- `pnpm db:generate` - Generate Drizzle migration files
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Drizzle Studio for database management
- `pnpm db:push` - Push schema changes directly to database
- `pnpm db:pull` - Pull schema from database
- `pnpm db:check` - Check migration consistency

## Architecture Overview

### Project Structure
This is a Next.js 15 AI chatbot application using the App Router with the following key architectural patterns:

### App Router Structure
- `app/(auth)/` - Authentication pages and API routes (login, register, guest auth)
- `app/(chat)/` - Main chat interface and related API routes
- Route groups used for organizing layouts and shared components

### AI Integration Architecture
- **AI SDK**: Unified interface for multiple LLM providers via Vercel AI Gateway
- **Default Model**: Uses xAI's grok models through AI Gateway
- **MCP Support**: Model Context Protocol integration for extensible tools
- **Local Tools**: Built-in tools for weather, code comparison, and PlantUML
- **Tool System**: Extensible architecture in `lib/ai/tools/`

### Database Schema (Drizzle + PostgreSQL)
- **Users**: Authentication and user management
- **Chats**: Conversation persistence with visibility controls
- **Messages**: Message storage with parts/attachments structure
- **Votes**: Message voting system
- **Streams**: Real-time conversation streaming
- **UserMemory**: Persistent user memory for chat personalization

### Component Architecture
- **shadcn/ui**: Base UI components in `components/ui/`
- **Chat Elements**: Specialized chat components in `components/elements/`
- **Modular Design**: Each message type has dedicated renderers
- **Theme Support**: Dark/light mode with next-themes

### Authentication System
- **NextAuth.js v5**: Modern authentication with beta features
- **Guest Mode**: Temporary chat sessions without registration
- **User Persistence**: Full chat history for registered users

### Real-time Features
- **Streaming**: AI responses stream in real-time
- **Data Streams**: Custom provider for handling streaming data
- **Memory Integration**: Context-aware conversations with user memory

## Key Technologies
- **Framework**: Next.js 15 with App Router and PPR (Partial Prerendering)
- **AI**: Vercel AI SDK with xAI models via AI Gateway
- **Database**: Neon Serverless Postgres with Drizzle ORM
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Authentication**: NextAuth.js v5
- **Storage**: Vercel Blob for file uploads
- **Testing**: Playwright for E2E testing
- **Code Quality**: Ultracite (Biome-based) for formatting and linting

## Important Implementation Notes

### Code Quality Standards
The project uses Ultracite with strict TypeScript and accessibility rules. Key requirements:
- No TypeScript `any` types or non-null assertions
- Strict accessibility compliance (ARIA, semantic HTML)
- React hooks best practices and dependency arrays
- No `console.log` statements in production code
- Use `export type` for type-only exports

### AI Tool Development
When adding new AI tools:
1. Create tool in `lib/ai/tools/` following existing patterns
2. Export from `lib/ai/tools/index.ts`
3. Add corresponding UI renderer in `components/elements/`
4. Tools support both local and MCP (Model Context Protocol) integration

### Database Migrations
- Always generate migrations with `pnpm db:generate` before schema changes
- Build process automatically runs migrations via `lib/db/migrate.ts`
- Use Drizzle Studio for development database inspection

### Memory System
The application features user memory management:
- Stored in `userMemory` table with title/content structure
- Integrated into chat context for personalized responses
- Memory can be activated/deactivated per user preference

### Component Patterns
- Use React 19 RC features where appropriate
- Implement proper error boundaries for AI interactions
- Follow existing patterns for message rendering and tool integration
- Maintain responsive design with proper mobile support

### Performance Considerations
- Uses Next.js 15 with Partial Prerendering (PPR) experimental feature
- Implements proper streaming for AI responses
- Optimized for mobile and desktop experiences
- Uses efficient data structures for message handling