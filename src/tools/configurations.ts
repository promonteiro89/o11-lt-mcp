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
      "Returns the per-environment deployment configuration of an application: for every " +
      "environment, its environmentKey, isBlocked (true = the application cannot be deployed " +
      "to that environment) and isBlockedChangeReason. " +
      "Note: the LifeTime API does not expose site properties, timer schedules or REST " +
      "endpoint settings — only this deployment-blocking flag. " +
      "Use update_application_configurations to change it.",
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
      "Blocks or unblocks deployments of an application to a SPECIFIC environment by setting " +
      "its isBlocked flag (with an optional reason). This is the only attribute the LifeTime " +
      "API allows changing here — site properties and timers are not exposed. " +
      "Call get_application_configurations first to see the current state.",
    inputSchema: {
      type: "object",
      properties: {
        ApplicationKey: {
          type: "string",
          description: "Unique key of the application.",
        },
        EnvironmentKey: {
          type: "string",
          description: "Key of the environment whose configuration should be updated.",
        },
        IsBlocked: {
          type: "boolean",
          description:
            "true to block deployments of the application to this environment, false to allow them.",
        },
        IsBlockedChangeReason: {
          type: "string",
          description: "Optional reason for the change (recorded by LifeTime).",
        },
      },
      required: ["ApplicationKey", "EnvironmentKey", "IsBlocked"],
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
      const { ApplicationKey, EnvironmentKey, IsBlocked, IsBlockedChangeReason } =
        UpdateApplicationConfigurationsSchema.parse(args);
      return runTool(async () => {
        // Matches the ApplicationConfigurations definition in the API spec
        const payload = {
          configurations: [
            {
              environmentKey: EnvironmentKey,
              isBlocked: IsBlocked,
              isBlockedChangeReason: IsBlockedChangeReason,
            },
          ],
        };
        await api.put(
          `/applications/${ApplicationKey}/configurations/`,
          payload
        );
        return {
          message: `Application ${ApplicationKey} is now ${IsBlocked ? "blocked" : "unblocked"} for deployments to environment ${EnvironmentKey}.`,
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
