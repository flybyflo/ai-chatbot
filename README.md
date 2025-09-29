<h1 align="center">
AI-Chatbot
</h1>

<p align="center">
  A modern chat runtime built on top of Vercel's Chat SDK template and extended with stronger auth, richer tooling, and Azure integrations.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#integrations"><strong>Integrations</strong></a> ·
  <a href="#getting-started"><strong>Getting Started</strong></a>
</p>

## Features

- **Next.js App Router + Turbopack** – Server Components, Server Actions, and instant hot reloads.
- **AI SDK chat runtime** – Structured tool calling, streaming UI parts, and multi-model support.
- **Polished UI system** – Tailwind, shadcn/ui primitives, and custom styling for a dashboard-style chat surface.
- **Persistent chat history & uploads** – Postgres for chats, Redis for sessions/queues, and Azure Blob for user files (Docker Compose ready).
- **Inline tool visualisation** – A2A/MCP interactions render directly in the conversation flow with status, artifacts, and logs.

## Integrations

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

1. Copy `.env.example` to `.env.local` and populate the Azure, Better Auth, Postgres, Redis, and AI credentials you plan to use.
2. Start the optional data stack (Postgres + Redis) with Docker Compose:
   ```bash
   docker compose up -d
   ```
3. Install dependencies and run the dev server:
   ```bash
   pnpm install
   pnpm dev
   ```

The app runs on [http://localhost:3000](http://localhost:3000). Hot reloading works out of the box.

## Credit

This project started as the public <code>vercel/ai-chatbot</code> template and expanded to include Better Auth, MCP tool orchestration, A2A agent workflows, refreshed styling, and Azure platform support.
