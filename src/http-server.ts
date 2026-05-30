/**
 * Streamable HTTP transport for the OutSystems LifeTime MCP server.
 *
 * Starts a plain Node.js HTTP server on the given port that speaks the MCP
 * Streamable HTTP protocol (POST /mcp, GET /mcp for SSE, DELETE /mcp).
 *
 * Each new `initialize` request creates a fresh MCP Server+Transport pair.
 * Subsequent requests from the same client reuse the existing transport via
 * the `mcp-session-id` header the SDK writes automatically.
 *
 * Optionally protect the endpoint with a Bearer token by setting the
 * HTTP_BEARER_TOKEN environment variable.
 */

import http from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export type ServerFactory = () => Server;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: Record<string, unknown>
): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json),
  });
  res.end(json);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function startHttpServer(port: number, createServer: ServerFactory): void {
  const sessions = new Map<string, StreamableHTTPServerTransport>();
  const bearerToken = process.env.HTTP_BEARER_TOKEN;

  const httpServer = http.createServer(async (req, res) => {
    try {
      // ── Auth check ──────────────────────────────────────────────────────
      if (bearerToken) {
        const auth = req.headers["authorization"] ?? "";
        if (auth !== `Bearer ${bearerToken}`) {
          res.writeHead(401, { "WWW-Authenticate": 'Bearer realm="lt-mcp"' });
          res.end("Unauthorized");
          return;
        }
      }

      // ── CORS preflight ───────────────────────────────────────────────────
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, mcp-session-id"
      );
      res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      // ── Route: only /mcp is handled ──────────────────────────────────────
      const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
      if (pathname !== "/mcp") {
        if (pathname === "/health") {
          sendJson(res, 200, { status: "ok", sessions: sessions.size });
          return;
        }
        res.writeHead(404);
        res.end("Not found — use POST /mcp");
        return;
      }

      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      // ── GET /mcp — SSE stream for server-initiated messages ──────────────
      if (req.method === "GET") {
        if (!sessionId || !sessions.has(sessionId)) {
          res.writeHead(404);
          res.end("Session not found");
          return;
        }
        const transport = sessions.get(sessionId)!;
        await transport.handleRequest(req, res);
        return;
      }

      // ── DELETE /mcp — close session ──────────────────────────────────────
      if (req.method === "DELETE") {
        if (sessionId && sessions.has(sessionId)) {
          const transport = sessions.get(sessionId)!;
          await transport.close();
          sessions.delete(sessionId);
          console.error(`[lt-mcp/http] Session closed: ${sessionId}`);
        }
        res.writeHead(200);
        res.end();
        return;
      }

      // ── POST /mcp — main MCP endpoint ────────────────────────────────────
      if (req.method === "POST") {
        // Parse JSON body
        const raw = await readBody(req);
        let parsedBody: unknown;
        try {
          parsedBody = JSON.parse(raw);
        } catch {
          res.writeHead(400);
          res.end("Invalid JSON body");
          return;
        }

        // If there's an existing session, route to it
        if (sessionId && sessions.has(sessionId)) {
          const transport = sessions.get(sessionId)!;
          await transport.handleRequest(req, res, parsedBody);
          return;
        }

        // New session — only allow initialize here
        const method = (parsedBody as Record<string, unknown>)?.method;
        if (method !== "initialize") {
          sendJson(res, 400, {
            error: "First request must be an MCP initialize call",
          });
          return;
        }

        // Generate the session ID upfront so we can store it before
        // handleRequest fires (the SDK sets sessionId lazily inside handleRequest).
        const newSessionId = randomUUID();

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
        });

        // Register before handleRequest so that any follow-up request
        // arriving while we're still handling this one can find the session.
        sessions.set(newSessionId, transport);
        console.error(
          `[lt-mcp/http] New session: ${newSessionId} (total: ${sessions.size})`
        );

        transport.onclose = () => {
          sessions.delete(newSessionId);
          console.error(`[lt-mcp/http] Session closed: ${newSessionId}`);
        };

        const server = createServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, parsedBody);
        return;
      }

      // ── Unknown method ───────────────────────────────────────────────────
      res.writeHead(405, { Allow: "GET, POST, DELETE, OPTIONS" });
      res.end("Method Not Allowed");
    } catch (err) {
      console.error("[lt-mcp/http] Unhandled request error:", err);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end("Internal server error");
      }
    }
  });

  httpServer.listen(port, () => {
    console.error(
      `[lt-mcp] HTTP server ready — POST http://localhost:${port}/mcp` +
        (bearerToken ? "  (Bearer auth enabled)" : "  ⚠️  No auth — set HTTP_BEARER_TOKEN")
    );
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.error("[lt-mcp/http] Shutting down…");
    httpServer.close();
  });
}
