// Shared types for the tool composition layer (see registry.ts).

import { AxiosInstance } from "axios";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { MCPToolResult } from "./tool-helpers.js";

/** A tool implementation: validates its args, returns an MCP result. */
export type ToolHandler = (args: unknown) => Promise<MCPToolResult>;

/** Maps a tool name to its handler. */
export type HandlerMap = Record<string, ToolHandler>;

/** A tool domain: its definitions plus a factory that builds their handlers. */
export interface ToolModule {
  tools: Tool[];
  handlers: (api: AxiosInstance) => HandlerMap;
}
