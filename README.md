<h1 align="center">
AI-Chatbot
</h1>

<p align="center">
  A modern chat runtime powered by Convex, Better Auth, and the AI SDK with support for MCP tools, A2A agents, and Azure integrations.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#integrations"><strong>Integrations</strong></a> ·
  <a href="#getting-started"><strong>Getting Started</strong></a>
</p>

## Features

- **Next.js App Router + Turbopack** – Server Components, Server Actions, and instant hot reloads.
- **Convex backend** – Realtime database, serverless functions, and type-safe queries for chat history and user data.
- **AI SDK chat runtime** – Structured tool calling, streaming UI parts, and multi-model support.
- **Polished UI system** – Tailwind, shadcn/ui primitives, and custom styling for a dashboard-style chat surface.
- **Inline tool visualisation** – A2A/MCP interactions render directly in the conversation flow with status, artifacts, and logs.

## Integrations

### Convex

Realtime backend-as-a-service for chat storage, user management, and MCP/A2A server configuration. Type-safe queries and mutations with automatic code generation.

### Better Auth

Secure e-mail/password authentication powered by [better-auth](https://github.com/better-auth/better-auth) with session cookies wired into the App Router middleware.

### Model Context Protocol (MCP)

Bring your own MCP servers. The app can discover tools, execute them, and show results inline.

### Agent-to-Agent (A2A)

First-class support for the A2A protocol: the chat client fetches agent cards, manages task lifecycles, and displays responses and artifacts inline. [WIP]

### Azure

- **Azure AI Foundry** provider bindings for the AI SDK.
- **Azure Blob Storage** for uploads and attachments.

## Getting Started

1. Copy `.env.example` to `.env.local` and populate the Convex, Better Auth, Azure, and AI credentials you plan to use.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start the Convex dev server:
   ```bash
   pnpm dlx convex dev
   ```
4. In a separate terminal, run the Next.js dev server:
   ```bash
   pnpm dev
   ```

The app runs on [http://localhost:3000](http://localhost:3000). Hot reloading works out of the box.

## Credit

Built with Convex for backend infrastructure, Better Auth for authentication, and the Vercel AI SDK for chat runtime. Includes MCP tool orchestration, A2A agent workflows, and Azure platform integrations.
