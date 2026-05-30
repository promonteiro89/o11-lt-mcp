#!/usr/bin/env bash
# start-remote.sh — Start the lt-mcp HTTP server and expose it via ngrok
# Usage: ./start-remote.sh
#
# Required env vars (can be in a .env file or exported beforehand):
#   LIFETIME_BASE_URL   – e.g. https://your-lifetime.example.com/lifetimeapi/rest/v2
#   LIFETIME_API_TOKEN  – LifeTime Service Account Bearer token
#
# Optional:
#   HTTP_PORT           – port for the local HTTP server (default: 3456)
#   HTTP_BEARER_TOKEN   – token Claude.ai must send to authenticate (STRONGLY recommended)

set -e

# ── Load .env if present ────────────────────────────────────────────────────
if [ -f "$(dirname "$0")/.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$(dirname "$0")/.env" | xargs)
fi

# ── Defaults ────────────────────────────────────────────────────────────────
HTTP_PORT="${HTTP_PORT:-3456}"

# ── Validation ──────────────────────────────────────────────────────────────
if [ -z "$LIFETIME_BASE_URL" ]; then
  echo "ERROR: LIFETIME_BASE_URL is not set." >&2
  exit 1
fi
if [ -z "$LIFETIME_API_TOKEN" ]; then
  echo "ERROR: LIFETIME_API_TOKEN is not set." >&2
  exit 1
fi
if [ -z "$HTTP_BEARER_TOKEN" ]; then
  echo "WARNING: HTTP_BEARER_TOKEN not set — endpoint will be unauthenticated." >&2
fi

# ── Build if needed ──────────────────────────────────────────────────────────
if [ ! -f "$(dirname "$0")/dist/index.js" ]; then
  echo "Building…"
  npm run build
fi

# ── Start MCP server in background ──────────────────────────────────────────
echo "Starting MCP server on port $HTTP_PORT…"
HTTP_PORT="$HTTP_PORT" node "$(dirname "$0")/dist/index.js" &
MCP_PID=$!

# Give it a moment to bind
sleep 1

# ── Start ngrok tunnel ───────────────────────────────────────────────────────
echo ""
echo "Starting ngrok tunnel…"
echo "──────────────────────────────────────────────────────────"
echo " Once ngrok shows the forwarding URL, copy the HTTPS address."
echo " Then in Claude.ai → Settings → Integrations → Add MCP Server:"
echo ""
echo "   URL:    https://<ngrok-subdomain>.ngrok-free.app/mcp"
if [ -n "$HTTP_BEARER_TOKEN" ]; then
echo "   Token:  $HTTP_BEARER_TOKEN"
fi
echo ""
echo " Press Ctrl+C to stop everything."
echo "──────────────────────────────────────────────────────────"
echo ""

# Cleanup on exit
trap "kill $MCP_PID 2>/dev/null; echo 'Stopped.'" EXIT INT TERM

ngrok http "$HTTP_PORT"
