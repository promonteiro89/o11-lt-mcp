import { ZodError } from "zod";
import { LifeTimeAPIError } from "./api-client.js";

// A `type` alias (not an `interface`) on purpose: anonymous object types carry
// an implicit index signature, which makes this assignable to the MCP SDK's
// `CallToolResult` union. A named interface would not be.
export type MCPToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/**
 * Wraps an async tool implementation.
 * - On success  → returns the JSON payload as a formatted text block.
 * - On LifeTime API error → returns the `Errors` array verbatim so the LLM
 *   knows exactly why the operation failed.
 * - On Zod validation error → returns a human-readable schema error.
 * - On any other error → surfaces the message.
 */
export async function runTool(
  fn: () => Promise<unknown>
): Promise<MCPToolResult> {
  try {
    const result = await fn();
    return {
      content: [
        {
          type: "text",
          text: result === undefined || result === null
            ? "Operation completed successfully (no content returned)."
            : JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    if (err instanceof LifeTimeAPIError) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { errors: err.errors, statusCode: err.statusCode },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }

    if (err instanceof ZodError) {
      return {
        content: [
          {
            type: "text",
            text: `Input validation failed:\n${err.errors
              .map((e) => `  • ${e.path.join(".")}: ${e.message}`)
              .join("\n")}`,
          },
        ],
        isError: true,
      };
    }

    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Unexpected error: ${msg}` }],
      isError: true,
    };
  }
}
