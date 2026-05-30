import { AxiosInstance } from "axios";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  GetApplicationsSchema,
  GetEnvironmentTemplatesSchema,
  CreateApplicationSchema,
  GetApplicationSchema,
  ListApplicationVersionsSchema,
  GetApplicationVersionSchema,
  DeleteApplicationVersionSchema,
} from "../schemas.js";
import { MCPToolResult, runTool } from "../tool-helpers.js";

export const applicationsTools: Tool[] = [
  {
    name: "get_environment_templates",
    description:
      "Returns the list of application templates available in a given environment " +
      "(e.g. Reactive Web App, Mobile App, Service). " +
      "The TemplateKey returned here is required by create_application. " +
      "Always call this before creating an application to pick the right template.",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description:
            "Key of the environment to query. Use get_environments to find it. " +
            "Templates are typically fetched from the Development environment.",
        },
      },
      required: ["EnvironmentKey"],
    },
  },
  {
    name: "create_application",
    description:
      "Creates a new application in a given environment using a template. " +
      "Workflow: (1) get_environments → EnvironmentKey, " +
      "(2) get_environment_templates → TemplateKey, " +
      "(3) list_teams or create_team → TeamKey, " +
      "(4) create_application.",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description: "Key of the environment where the app will be created.",
        },
        Name: {
          type: "string",
          description: "Unique name for the new application.",
        },
        TemplateKey: {
          type: "string",
          description: "Template key from get_environment_templates.",
        },
        TeamKey: {
          type: "string",
          description: "Key of the owning team.",
        },
        Color: {
          type: "string",
          description: "Primary theme colour in hex, e.g. #3A7BD5. Defaults to #FF0000.",
        },
        Description: {
          type: "string",
          description: "Optional description of the application.",
        },
      },
      required: ["EnvironmentKey", "Name", "TemplateKey", "TeamKey"],
    },
  },
  {
    name: "get_applications",
    description:
      "Returns all applications across the OutSystems infrastructure. " +
      "Use IncludeEnvStatus=true to get per-environment deployment status and " +
      "application version keys (needed for create_deployment). " +
      "Use IncludeModules=true to also retrieve module-level details (requires IncludeEnvStatus=true). " +
      "The response includes Keys, Names, Teams, and per-environment statuses.",
    inputSchema: {
      type: "object",
      properties: {
        IncludeModules: {
          type: "boolean",
          description:
            "When true, module details are included. Requires IncludeEnvStatus=true.",
        },
        IncludeEnvStatus: {
          type: "boolean",
          description:
            "When true, per-environment status (including version keys) is included.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_application",
    description:
      "Returns the details of a single application (key, name, kind, team, icon, " +
      "description). Use get_applications to discover ApplicationKeys.",
    inputSchema: {
      type: "object",
      properties: {
        ApplicationKey: {
          type: "string",
          description: "Unique key of the application.",
        },
      },
      required: ["ApplicationKey"],
    },
  },
  {
    name: "list_application_versions",
    description:
      "Lists all versions of a given application, each with its VersionKey, version label, " +
      "creation date and changelog. Useful for picking a specific version to deploy or discard.",
    inputSchema: {
      type: "object",
      properties: {
        ApplicationKey: {
          type: "string",
          description: "Unique key of the application.",
        },
      },
      required: ["ApplicationKey"],
    },
  },
  {
    name: "get_application_version",
    description:
      "Returns the details of a specific application version, including modules and changelog. " +
      "Use list_application_versions to find VersionKeys.",
    inputSchema: {
      type: "object",
      properties: {
        ApplicationKey: {
          type: "string",
          description: "Unique key of the application.",
        },
        VersionKey: {
          type: "string",
          description: "Unique key of the application version.",
        },
      },
      required: ["ApplicationKey", "VersionKey"],
    },
  },
  {
    name: "delete_application_version",
    description:
      "Discards (deletes) a specific application version. This is irreversible. " +
      "The version cannot be deleted if it is currently running in any environment.",
    inputSchema: {
      type: "object",
      properties: {
        ApplicationKey: {
          type: "string",
          description: "Unique key of the application.",
        },
        VersionKey: {
          type: "string",
          description: "Unique key of the version to discard.",
        },
      },
      required: ["ApplicationKey", "VersionKey"],
    },
  },
];

export function applicationsHandlers(
  api: AxiosInstance
): Record<string, (args: unknown) => Promise<MCPToolResult>> {
  return {
    get_environment_templates: async (args) => {
      const { EnvironmentKey } = GetEnvironmentTemplatesSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(
          `/environments/${EnvironmentKey}/templates/`
        );
        return data;
      });
    },

    create_application: async (args) => {
      const { EnvironmentKey, ...body } = CreateApplicationSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.post(
          `/environments/${EnvironmentKey}/applications/`,
          body
        );
        return data;
      });
    },

    get_applications: async (args) => {
      const params = GetApplicationsSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get("/applications/", { params });
        return data;
      });
    },

    get_application: async (args) => {
      const { ApplicationKey } = GetApplicationSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(`/applications/${ApplicationKey}/`);
        return data;
      });
    },

    list_application_versions: async (args) => {
      const { ApplicationKey } = ListApplicationVersionsSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(
          `/applications/${ApplicationKey}/versions/`
        );
        return data;
      });
    },

    get_application_version: async (args) => {
      const { ApplicationKey, VersionKey } =
        GetApplicationVersionSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(
          `/applications/${ApplicationKey}/versions/${VersionKey}/`
        );
        return data;
      });
    },

    delete_application_version: async (args) => {
      const { ApplicationKey, VersionKey } =
        DeleteApplicationVersionSchema.parse(args);
      return runTool(async () => {
        await api.delete(
          `/applications/${ApplicationKey}/versions/${VersionKey}/`
        );
        return `Application version ${VersionKey} successfully discarded.`;
      });
    },
  };
}
