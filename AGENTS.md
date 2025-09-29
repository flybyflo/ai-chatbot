# Repository Guidelines

## Project Structure & Module Organization
- `app/` – Next.js routes, layouts, and API handlers (notably `app/(chat)/api/...` for chat, A2A, and MCP endpoints).
- `components/` – Client UI: chat surface, inline tool renderers, shared layout primitives.
- `lib/` – Core services (AI adapters, Better Auth config, database queries, storage helpers) plus `lib/ai/a2a` and `lib/ai/mcp` wrappers.
- `hooks/`, `types/`, `test-a2a/`, `test-mcp/` – React hooks, shared TypeScript types, example agent implementations.
- `docker-compose.yml` spins up Postgres + Redis; database migrations live under `lib/db/migrations`.

## Build, Test, and Development Commands
- `pnpm dev` – Launch the dev server (Next.js + Turbopack).
- `pnpm build` – Apply migrations (`tsx lib/db/migrate`) then build the production bundle.
- `pnpm start` – Serve the production build.
- `pnpm lint` / `pnpm format` – Run Biome (Ultracite) for linting/formatting.
- `pnpm test` – Execute Playwright end-to-end tests (`PLAYWRIGHT=True`).
- Docker stack: `docker compose up -d` boots Postgres and Redis locally.

## Coding Style & Naming Conventions
- TypeScript everywhere; leverage async/await and ES module imports.
- Biome defaults: 2-space indent, double quotes, trailing commas.
- React components in PascalCase; file names in kebab-case mirroring directories.
- API routes follow Next.js routing conventions (`app/(chat)/api/<name>/route.ts`).

## Testing Guidelines
- Playwright orchestrates browser tests (`playwright.config.ts`).
- Organize specs under `tests/feature-name/*.spec.ts` with descriptive `test/it("…")` titles.
- Ensure `pnpm test`, `pnpm lint`, and `pnpm tsc --noEmit` pass before opening a PR.

## Commit & Pull Request Guidelines
- Use focused commits (`feat: add inline a2a response bubble`).
- PRs must include a summary, linked issue (if any), UI screenshots for visual changes, and test results.
- Keep branches rebased; reviewers expect clean histories.

## Security & Configuration Tips
- Store secrets in `.env.local`; never commit credentials.
- Azure, Better Auth, and MCP/A2A endpoints should be scoped per environment.
- Rotate API keys regularly and prefer least-privilege tokens for agents.
