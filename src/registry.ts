/**
 * Tool registry — the single place where domains are registered. The combined
 * tool list, handler map and integrity check are all derived from `toolModules`.
 * Kept separate from index.ts so it can be unit-tested without a transport.
 */

import { AxiosInstance } from "axios";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { HandlerMap, ToolModule } from "./types.js";
import { environmentsTools, environmentsHandlers } from "./tools/environments.js";
import { applicationsTools, applicationsHandlers } from "./tools/applications.js";
import { usersTools, usersHandlers } from "./tools/users.js";
import { teamsTools, teamsHandlers } from "./tools/teams.js";
import { deploymentsTools, deploymentsHandlers } from "./tools/deployments.js";
import { rolesTools, rolesHandlers } from "./tools/roles.js";
import { modulesTools, modulesHandlers } from "./tools/modules.js";
import { dbConnectionsTools, dbConnectionsHandlers } from "./tools/db-connections.js";
import { configurationsTools, configurationsHandlers } from "./tools/configurations.js";
import { operationsTools, operationsHandlers } from "./tools/operations.js";

/** Every tool domain. Adding or removing one is a single line here. */
export const toolModules: ToolModule[] = [
  { tools: environmentsTools, handlers: environmentsHandlers },
  { tools: applicationsTools, handlers: applicationsHandlers },
  { tools: usersTools, handlers: usersHandlers },
  { tools: teamsTools, handlers: teamsHandlers },
  { tools: deploymentsTools, handlers: deploymentsHandlers },
  { tools: rolesTools, handlers: rolesHandlers },
  { tools: modulesTools, handlers: modulesHandlers },
  { tools: dbConnectionsTools, handlers: dbConnectionsHandlers },
  { tools: configurationsTools, handlers: configurationsHandlers },
  { tools: operationsTools, handlers: operationsHandlers },
];

export interface Registry {
  tools: Tool[];
  handlers: HandlerMap;
}

/** Flattens every domain into the combined tool list + handler map. */
export function buildRegistry(api: AxiosInstance): Registry {
  const tools = toolModules.flatMap((m) => m.tools);
  const handlers: HandlerMap = Object.assign(
    {},
    ...toolModules.map((m) => m.handlers(api))
  );
  return { tools, handlers };
}

/**
 * Pure consistency check. Returns a list of human-readable problems; an empty
 * array means the registry is healthy. Flags:
 *   - duplicate tool names,
 *   - tools advertised with no handler,
 *   - handlers that back no advertised tool.
 */
export function findRegistryProblems(
  tools: Tool[],
  handlers: HandlerMap
): string[] {
  const declaredNames = tools.map((t) => t.name);
  const toolNames = new Set(declaredNames);
  const handlerNames = new Set(Object.keys(handlers));

  const duplicateTools = [
    ...new Set(declaredNames.filter((n, i) => declaredNames.indexOf(n) !== i)),
  ];
  const toolsWithoutHandler = [...toolNames].filter((n) => !handlerNames.has(n));
  const handlersWithoutTool = [...handlerNames].filter((n) => !toolNames.has(n));

  const problems: string[] = [];
  if (duplicateTools.length)
    problems.push(`Duplicate tool names: ${duplicateTools.join(", ")}`);
  if (toolsWithoutHandler.length)
    problems.push(`Tools missing a handler: ${toolsWithoutHandler.join(", ")}`);
  if (handlersWithoutTool.length)
    problems.push(`Handlers with no tool definition: ${handlersWithoutTool.join(", ")}`);

  return problems;
}
