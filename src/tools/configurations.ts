import { AxiosInstance } from "axios";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  GetApplicationConfigurationsSchema,
  UpdateApplicationConfigurationsSchema,
  TagRunningVersionSchema,
} from "../schemas.js";
import { MCPToolResult, runTool } from "../tool-helpers.js";

export const configurationsTools: Tool[] = [
  {
    name: "get_application_configurations",
    description:
      "Returns the configuration values (site properties, timer schedules, REST endpoints) " +
      "for a given application across every environment where it is deployed. " +
      "Useful for auditing per-environment settings and spotting drift between DEV/QA/PRD. " +
      "Use update_application_configurations to modify a value.",
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
    name: "update_application_configurations",
    description:
      "Updates configuration values (site properties, timer schedules, etc.) for an application " +
      "in a SPECIFIC environment. Workflow: " +
      "(1) call get_application_configurations to discover Keys and current Values, " +
      "(2) call update_application_configurations with the items to change. " +
      "Only the items you list are modified; everything else stays untouched.",
    inputSchema: {
      type: "object",
      properties: {
        ApplicationKey: {
          type: "string",
          description: "Unique key of the application.",
        },
        EnvironmentKey: {
          type: "string",
          description:
            "Key of the environment in which the configuration values should be applied.",
        },
        Configurations: {
          type: "array",
          minItems: 1,
          description: "Configuration items to update.",
          items: {
            type: "object",
            properties: {
              Key: {
                type: "string",
                description:
                  "Configuration item key from get_application_configurations.",
              },
              Value: {
                type: "string",
                description: "New value to set.",
              },
            },
            required: ["Key", "Value"],
          },
        },
      },
      required: ["ApplicationKey", "EnvironmentKey", "Configurations"],
    },
  },
  {
    name: "tag_running_version",
    description:
      "Tags whatever is currently running in an environment as a NEW version of the application — " +
      "useful for hotfix workflows or to capture exactly what is live in production. " +
      "Requires the application to actually be running in the target environment. " +
      "Returns the new ApplicationVersionKey on success.",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description: "Key of the environment where the application is running.",
        },
        ApplicationKey: {
          type: "string",
          description: "Unique key of the application to tag.",
        },
        Version: {
          type: "string",
          description: 'Version label to assign (e.g. "1.5.2").',
        },
        ChangeLog: {
          type: "string",
          description: "Optional changelog / release notes for the new version.",
        },
        MobileVersions: {
          type: "array",
          description:
            "Optional mobile build versions, one entry per platform (Android/iOS).",
          items: {
            type: "object",
            properties: {
              NativePlatform: {
                type: "string",
                enum: ["Android", "iOS"],
                description: "Mobile platform.",
              },
              NativeBuild: {
                type: "number",
                description: "Native build number for that platform.",
              },
            },
            required: ["NativePlatform", "NativeBuild"],
          },
        },
      },
      required: ["EnvironmentKey", "ApplicationKey", "Version"],
    },
  },
];

export function configurationsHandlers(
  api: AxiosInstance
): Record<string, (args: unknown) => Promise<MCPToolResult>> {
  return {
    get_application_configurations: async (args) => {
      const { ApplicationKey } = GetApplicationConfigurationsSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(
          `/applications/${ApplicationKey}/configurations/`
        );
        return data;
      });
    },

    update_application_configurations: async (args) => {
      const { ApplicationKey, EnvironmentKey, Configurations } =
        UpdateApplicationConfigurationsSchema.parse(args);
      return runTool(async () => {
        // The LifeTime API expects an array of environment-scoped config blocks
        const payload = [
          {
            EnvironmentKey,
            Configurations: Configurations.map((c) => ({
              Key: c.Key,
              Value: c.Value,
            })),
          },
        ];
        await api.put(
          `/applications/${ApplicationKey}/configurations/`,
          payload
        );
        return {
          message: `Configurations updated for application ${ApplicationKey} in environment ${EnvironmentKey}.`,
          updatedCount: Configurations.length,
        };
      });
    },

    tag_running_version: async (args) => {
      const { EnvironmentKey, ApplicationKey, Version, ChangeLog, MobileVersions } =
        TagRunningVersionSchema.parse(args);
      return runTool(async () => {
        const payload: Record<string, unknown> = {
          Version,
          ChangeLog: ChangeLog ?? "",
        };
        if (MobileVersions && MobileVersions.length > 0) {
          payload.MobileVersions = MobileVersions;
        }
        const { data } = await api.post(
          `/environments/${EnvironmentKey}/applications/${ApplicationKey}/versions/`,
          payload
        );
        return {
          message: `Running application tagged as version ${Version}.`,
          data,
        };
      });
    },
  };
}
