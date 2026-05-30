# OutSystems LifeTime MCP Server

[![CI](https://github.com/promonteiro89/o11-lt-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/promonteiro89/o11-lt-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-server-000000)](https://modelcontextprotocol.io)

A local [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that exposes the **OutSystems LifeTime REST API v2** as conversational tools.  
Connect it to Claude Desktop (or any MCP-compatible client) and manage deployments, users, teams and applications through natural language.

> **Unofficial community project** — not affiliated with or endorsed by OutSystems.
> It drives a powerful administrative API (it can create deployments, modify users, edit
> database connections and more). **Read the [Security](#security) section before using it.**

---

## Tools provided

66 tools across 10 domains, covering the LifeTime REST API v2:

| Domain | Tools | Examples |
|---|---:|---|
| Environments | 10 | `get_environments`, `create_environment`, `set_maintenance_mode` |
| Applications | 7 | `get_applications`, `get_application_dependencies`, `tag_running_version` |
| Deployments | 7 | `create_deployment`, `execute_deployment_command`, `get_deployment_status` |
| Users | 7 | `list_users`, `create_user`, `update_user` |
| Teams | 7 | `list_teams`, `manage_team_users`, `manage_team_apps` |
| Roles | 6 | `list_roles`, `create_role`, `manage_user_app_role` |
| Modules | 4 | `list_modules`, `get_module_version` |
| DB connections | 12 | `list_db_connections`, `update_db_connection`, `test_db_connection` |
| Configurations | 3 | `get_application_configurations`, `update_application_configurations` |
| Operations | 3 | `cleanup_old_deployment_plans`, `get_application_consumers` |

---

## Prerequisites

- **Docker** (recommended) — no Node.js install required on the host
- An OutSystems **LifeTime** instance (version 11)
- A **Service Account token** — create one in LifeTime → *User Management → Service Accounts*

---

## Docker setup (recommended)

### 1. Build the image

```bash
docker build -t outsystems-lifetime-mcp .
```

### 2. Smoke-test it

```bash
# Should print the FATAL env-var error and exit 1 — that means the binary works
docker run --rm outsystems-lifetime-mcp
```

### 3. Connect to Claude Desktop

Open (or create) the Claude Desktop config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the server entry under `"mcpServers"`:

```json
{
  "mcpServers": {
    "outsystems-lifetime": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-e", "LIFETIME_BASE_URL",
        "-e", "LIFETIME_API_TOKEN",
        "outsystems-lifetime-mcp"
      ],
      "env": {
        "LIFETIME_BASE_URL": "https://your-lifetime.example.com/lifetimeapi/rest/v2",
        "LIFETIME_API_TOKEN": "your-service-account-token"
      }
    }
  }
}
```

> The `-i` flag is required — it keeps stdin open so the MCP stdio protocol flows through Docker correctly.  
> The `-e` flags forward the env vars from the Claude Desktop process into the container.

4. **Restart Claude Desktop** — the tools will appear in the tools panel.

---

## Local Node.js setup (alternative, no Docker)

```bash
# Install dependencies and compile
npm install
npm run build

# Run
LIFETIME_BASE_URL="https://your-lifetime.example.com/lifetimeapi/rest/v2" \
LIFETIME_API_TOKEN="your-service-account-token" \
node dist/index.js
```

Claude Desktop config for the Node.js variant:

```json
{
  "mcpServers": {
    "outsystems-lifetime": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/outsystems-lifetime-mcp/dist/index.js"],
      "env": {
        "LIFETIME_BASE_URL": "https://your-lifetime.example.com/lifetimeapi/rest/v2",
        "LIFETIME_API_TOKEN": "your-service-account-token"
      }
    }
  }
}
```

---

## Example deployment workflow (conversational)

```
You: What environments do I have?
Claude: [calls get_environments] → Development (key: abc-123), Quality (key: def-456), Production (key: ghi-789)

You: Deploy the latest version of "CustomerPortal" from Development to Quality.
Claude: [calls get_applications with IncludeEnvStatus=true]
        [calls create_deployment with source=abc-123, target=def-456, version key]
        [calls execute_deployment_command with command=start]
        Deployment started! DeploymentKey: xyz-000

You: How's the deployment going?
Claude: [calls get_deployment_status] → running — "Publishing CustomerPortal..."

You: Done yet?
Claude: [calls get_deployment_status] → finished_successful ✓
```

---

## Error handling

The server propagates the LifeTime `Errors` array verbatim when an API call fails.  
For example, a 403 response surfaces as:

```json
{
  "errors": ["Invalid user permissions."],
  "statusCode": 403
}
```

This lets Claude explain exactly why an operation failed and suggest corrective actions.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `LIFETIME_BASE_URL` | ✅ | Full base URL of the LifeTime API, e.g. `https://lt.example.com/lifetimeapi/rest/v2` |
| `LIFETIME_API_TOKEN` | ✅ | Bearer token from a LifeTime Service Account |

---

## Project structure

```
src/
  index.ts            Entry point — env validation, server wiring, transport
  registry.ts         Tool registry: maps domains → tools + handlers
  types.ts            Shared composition types (ToolModule, HandlerMap)
  api-client.ts       Axios client with auth + LifeTime error extraction
  schemas.ts          Zod schemas for input validation
  tool-helpers.ts     Shared runTool wrapper & result type
  http-server.ts      Streamable HTTP transport (optional, for remote access)
  registry.test.ts    Registry integrity tests (node:test)
  tools/              One module per domain — environments, applications,
                      users, teams, deployments, roles, modules,
                      db-connections, configurations, operations
dist/                 Compiled output (after npm run build)
reference/            Vendored LifeTime REST API v2 Swagger spec (schema source)
```

---

## Development

```bash
npm run typecheck   # type-check without emitting
npm test            # registry integrity tests (node:test)
npm run build       # compile to dist/

# Run directly with tsx (no compile step)
LIFETIME_BASE_URL=... LIFETIME_API_TOKEN=... npm run dev
```

---

## Security

This server wraps a **privileged administrative API**. A Service Account token grants
broad control over your LifeTime infrastructure, and several tools perform **destructive
or irreversible** actions — e.g. `create_deployment` / `execute_deployment_command`,
`create_user` / `update_user`, `create_role` / `update_role` / `delete_role`,
`update_db_connection`, `manage_team_users`, and `set_maintenance_mode`.

Treat it accordingly:

- **Least privilege.** Create a dedicated Service Account scoped to only the
  environments and permissions you actually need. Don't reuse a personal admin token.
- **Protect the token.** It's effectively a root credential. Keep it in `.env`
  (gitignored) or your client's secret store — never commit it or paste it into shared
  configs. Rotate it if exposed.
- **Lock down HTTP mode.** The optional Streamable HTTP transport must run behind
  `HTTP_BEARER_TOKEN`; never expose an unauthenticated endpoint to a network or tunnel.
- **Prefer non-production first.** Point it at a Development/Test LifeTime before
  trusting it against Production.
- **Human-in-the-loop.** Keep your MCP client's tool-approval prompts on for write
  operations rather than auto-approving everything.

No credentials are logged, and the server only talks to the LifeTime URL you configure.

---

## Compatibility

- **OutSystems 11 (O11)** self-managed / cloud, via the **LifeTime REST API v2**
  (`/lifetimeapi/rest/v2`). Schemas were derived from the v2 Swagger spec in
  [`reference/`](reference/).
- **Not** for **OutSystems Developer Cloud (ODC)** — ODC has its own APIs and MCP
  tooling (see below).
- Requires **Node.js >= 18** (or Docker).

---

## Related projects

The OutSystems MCP space is split between **ODC** (cloud) and **LifeTime / O11**
(self-managed). Most tooling targets ODC; this project focuses on **LifeTime**.

| Project | Target | Approach |
|---|---|---|
| **this project** | LifeTime / O11 | Official REST API v2 — full read/write, 66 tools |
| [OutSystems/outsystems-mcp](https://github.com/OutSystems/outsystems-mcp) | ODC | Official remote MCP |
| [rpgomes-code/outsystems-mcp-extended](https://github.com/rpgomes-code/outsystems-mcp-extended) | ODC | Community server wrapping ODC REST APIs |

> Not to be confused with the unrelated Forge component also named *"MCP Server (O11)"*,
> which turns an O11 app into an MCP endpoint rather than managing LifeTime.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the dev workflow and how to add tools.

---

## License

[MIT](LICENSE) © Paulo Ricardo Monteiro
