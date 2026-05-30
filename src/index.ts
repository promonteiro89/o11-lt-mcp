#!/usr/bin/env node
/**
 * OutSystems LifeTime MCP Server
 *
 * Exposes the LifeTime REST API v2 as MCP tools so an LLM can manage
 * deployments, users, teams and applications conversationally.
 *
 * Required environment variables:
 *   LIFETIME_BASE_URL   – e.g. https://your-lifetime.example.com/lifetimeapi/rest/v2
 *   LIFETIME_API_TOKEN  – Service Account Bearer token
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { createApiClient } from "./api-client.js";
import { buildRegistry, findRegistryProblems } from "./registry.js";
import { startHttpServer } from "./http-server.js";

// ---------------------------------------------------------------------------
// Environment variable validation
// ---------------------------------------------------------------------------

const LIFETIME_BASE_URL = process.env.LIFETIME_BASE_URL;
const LIFETIME_API_TOKEN = process.env.LIFETIME_API_TOKEN;

if (!LIFETIME_BASE_URL) {
  console.error(
    "[lt-mcp] FATAL: LIFETIME_BASE_URL environment variable is required.\n" +
      "        Example: https://your-lifetime.example.com/lifetimeapi/rest/v2"
  );
  process.exit(1);
}

if (!LIFETIME_API_TOKEN) {
  console.error(
    "[lt-mcp] FATAL: LIFETIME_API_TOKEN environment variable is required.\n" +
      "        Generate a Service Account token in LifeTime → User Management → Service Accounts."
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// API client (shared by all tool handlers)
// ---------------------------------------------------------------------------

const api = createApiClient(LIFETIME_BASE_URL, LIFETIME_API_TOKEN);

// Build the tool list + handler map, then fail fast if they're inconsistent.
const { tools: allTools, handlers: allHandlers } = buildRegistry(api);

const registryProblems = findRegistryProblems(allTools, allHandlers);
if (registryProblems.length) {
  console.error(
    "[lt-mcp] FATAL: tool registry is inconsistent:\n  - " +
      registryProblems.join("\n  - ")
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// MCP Server factory
// Creates a fresh Server instance with all tools and handlers registered.
// Called once for stdio mode, and once per HTTP session in HTTP mode.
// ---------------------------------------------------------------------------

function createMcpServer(): Server {
  const server = new Server(
    {
      name: "outsystems-lifetime-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const handler = allHandlers[toolName];

    if (!handler) {
      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: "${toolName}". Available tools: ${allTools
              .map((t) => t.name)
              .join(", ")}`,
          },
        ],
        isError: true,
      };
    }

    return handler(request.params.arguments ?? {});
  });

  return server;
}

// ---------------------------------------------------------------------------
// Start — stdio (default) or HTTP (when HTTP_PORT is set)
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const httpPort = process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT, 10) : null;

  if (httpPort) {
    // HTTP / Streamable HTTP mode — for Claude.ai remote MCP and iOS Safari
    startHttpServer(httpPort, createMcpServer);
    console.error(
      `[lt-mcp] HTTP mode — ${allTools.length} tools — LifeTime: ${LIFETIME_BASE_URL}`
    );
  } else {
    // stdio mode — for Claude Code (default)
    const transport = new StdioServerTransport();
    await createMcpServer().connect(transport);
    // Log to stderr so it doesn't corrupt the stdio MCP protocol stream
    console.error(
      `[lt-mcp] stdio mode — ${allTools.length} tools — LifeTime: ${LIFETIME_BASE_URL}`
    );
  }
}

main().catch((err) => {
  console.error("[lt-mcp] Fatal startup error:", err);
  process.exit(1);
});
