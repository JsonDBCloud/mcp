# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@jsondb-cloud/mcp` is the official MCP (Model Context Protocol) server for [jsondb.cloud](https://jsondb.cloud). It exposes document CRUD, collections, schemas, versioning, webhooks, and vector/semantic search operations to AI agents such as Claude Code, Cursor, and Windsurf.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Production build via tsup (CJS + ESM) |
| `npm run dev` | Watch mode build |
| `npm run test` | Run tests via Vitest |
| `npm run lint` | ESLint on `src/` |
| `npm run format:check` | Prettier format check |

No unit test framework beyond Vitest. Tests live in `src/__tests__/`.

## Architecture

### Tech Stack
- **TypeScript 5**, built with **tsup** (CJS + ESM dual output)
- **@modelcontextprotocol/sdk** for MCP server and transports
- **@jsondb-cloud/client** (JsonDB SDK) for most tool implementations
- **Zod** for tool input validation schemas
- **Vitest** for testing

### Tool Registration Pattern
Each tool category has its own file in `src/tools/` exporting a `register*Tools(server, db)` function. These are called sequentially from `src/index.ts`. Tools use Zod schemas for input validation and return structured `{ content, isError? }` responses.

### Transport Modes
- **stdio** (default) — Standard MCP stdio transport for desktop clients
- **http** — Streamable HTTP transport via `StreamableHTTPServerTransport`. Creates a fresh `McpServer` + transport per request (stateless — no session affinity required). Serves MCP on `POST /mcp`, SSE on `GET /mcp`, session termination on `DELETE /mcp`, and a health check on `GET /health`.

### Embeddings
- Vector/semantic search embeddings are generated **asynchronously by the jsondb.cloud backend** using **Ollama** (`nomic-embed-text` model, **768 dimensions**).
- The MCP server itself does not call any embedding API — it delegates to the jsondb.cloud REST API, which handles embedding generation server-side.

### Helper Utilities
`src/tools/_helpers.ts` provides shared functions used by tools that call the REST API directly (e.g., vector tools):
- `success(data)` / `error(code, message, suggestion)` — standardized MCP response formatting
- `resolveEnv()` — reads `JSONDB_API_KEY`, `JSONDB_PROJECT`, `JSONDB_BASE_URL` from env
- `apiFetch(url, apiKey, method, body)` — authenticated fetch wrapper

### Key Directories
- `src/tools/` — Tool registration modules (documents, collections, schemas, versions, webhooks, vectors)
- `src/tools/_helpers.ts` — Shared response formatting and API fetch utilities
- `src/resources/` — MCP resource providers (collections)
- `src/__tests__/` — Vitest test suites
- `bin/` — CLI entry point (`jsondb-mcp`)
- `dist/` — Build output (CJS + ESM)

### Environment Variables
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JSONDB_API_KEY` | Yes | — | API key (`jdb_sk_live_...` or `jdb_sk_test_...`) |
| `JSONDB_PROJECT` | No | `v1` | Project namespace (falls back to `JSONDB_NAMESPACE`) |
| `JSONDB_BASE_URL` | No | `https://api.jsondb.cloud` | API base URL |
| `JSONDB_MCP_TRANSPORT` | No | `stdio` | Transport type: `stdio` or `http` |
| `JSONDB_MCP_PORT` | No | `3100` | HTTP port (only when transport is `http`) |
| `JSONDB_MCP_HOST` | No | `127.0.0.1` | HTTP bind address (only when transport is `http`) |

## Testing Patterns
- Tests use `createMockServer()` and `createMockDb()` from `src/__tests__/tools/_mock.js`
- Tool handlers are extracted from `server.tool.mock.calls` after registration
- `vi.spyOn(globalThis, 'fetch')` mocks HTTP calls for tools that use `apiFetch`
- `vi.stubEnv()` / `vi.unstubAllEnvs()` for environment variable isolation

## Formatting
- Prettier: default config
- Lint-staged runs Prettier + ESLint on `src/**/*.ts` via Husky pre-commit hook
