import { AxiosInstance } from "axios";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  ListModulesSchema,
  GetModuleSchema,
  ListModuleVersionsSchema,
  GetModuleVersionSchema,
} from "../schemas.js";
import { MCPToolResult, runTool } from "../tool-helpers.js";

export const modulesTools: Tool[] = [
  {
    name: "list_modules",
    description:
      "Lists every module across the LifeTime infrastructure with their keys, names, " +
      "kinds (e.g. eSpace, Extension) and parent application keys. " +
      "Useful for cross-application module discovery and dependency tracing.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_module",
    description:
      "Returns the details of a single module — key, name, kind, parent application, " +
      "and metadata. Use list_modules to discover ModuleKeys.",
    inputSchema: {
      type: "object",
      properties: {
        ModuleKey: { type: "string", description: "Unique key of the module." },
      },
      required: ["ModuleKey"],
    },
  },
  {
    name: "list_module_versions",
    description:
      "Lists all versions of a given module across environments, including their " +
      "ModuleVersionKey, version label and creation date.",
    inputSchema: {
      type: "object",
      properties: {
        ModuleKey: { type: "string", description: "Unique key of the module." },
      },
      required: ["ModuleKey"],
    },
  },
  {
    name: "get_module_version",
    description:
      "Returns the details of a specific module version, including changelog and metadata.",
    inputSchema: {
      type: "object",
      properties: {
        ModuleKey: { type: "string", description: "Unique key of the module." },
        ModuleVersionKey: {
          type: "string",
          description: "Unique key of the module version.",
        },
      },
      required: ["ModuleKey", "ModuleVersionKey"],
    },
  },
];

export function modulesHandlers(
  api: AxiosInstance
): Record<string, (args: unknown) => Promise<MCPToolResult>> {
  return {
    list_modules: async (args) => {
      ListModulesSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get("/modules/");
        return data;
      });
    },

    get_module: async (args) => {
      const { ModuleKey } = GetModuleSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(`/modules/${ModuleKey}/`);
        return data;
      });
    },

    list_module_versions: async (args) => {
      const { ModuleKey } = ListModuleVersionsSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(`/modules/${ModuleKey}/versions/`);
        return data;
      });
    },

    get_module_version: async (args) => {
      const { ModuleKey, ModuleVersionKey } =
        GetModuleVersionSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(
          `/modules/${ModuleKey}/versions/${ModuleVersionKey}/`
        );
        return data;
      });
    },
  };
}
