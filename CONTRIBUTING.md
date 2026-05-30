# Contributing

Thanks for helping improve the OutSystems LifeTime MCP server.

## Prerequisites

- Node.js >= 18
- A LifeTime instance + Service Account token for manual testing (see `.env.example`)

## Setup

```bash
npm install
cp .env.example .env   # fill in LIFETIME_BASE_URL and LIFETIME_API_TOKEN
```

## Development workflow

```bash
npm run typecheck   # tsc --noEmit (covers source and tests)
npm test            # registry integrity tests (node:test)
npm run build       # compile to dist/
npm run dev         # run from source with tsx
```

All three of `typecheck`, `test`, and `build` must pass before opening a PR.

## Adding or changing a tool

Tools are grouped by domain under `src/tools/` (environments, applications,
deployments, users, teams, roles, modules, db-connections, configurations,
operations). Each module exports two things:

- `xTools: Tool[]` — the MCP tool definitions.
- `xHandlers(api): HandlerMap` — a factory returning one handler per tool name.

To add a tool:

1. Add its Zod schema to `src/schemas.ts`.
2. Add the `Tool` definition and its handler to the relevant module in `src/tools/`.
3. If you're adding a whole new domain, register it with one line in
   `src/tools/`... then add it to `toolModules` in `src/registry.ts`.

The startup integrity check (`findRegistryProblems`) and the tests in
`src/registry.test.ts` guarantee every tool has exactly one handler and vice
versa — if you add a tool definition without a handler (or rename one), the
server fails fast at boot and `npm test` goes red.

## Conventions

- TypeScript strict mode; no `any` unless unavoidable.
- Validate every tool input with a Zod schema; never trust raw args.
- Surface LifeTime API errors verbatim via the shared `runTool` wrapper.
- Keep comments to what isn't obvious from the code.

## Pull requests

- Keep PRs focused on a single change.
- Describe what changed and why; note any new tools.
- Make sure `npm run typecheck && npm test && npm run build` is green.
