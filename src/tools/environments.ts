import { AxiosInstance } from "axios";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  GetEnvironmentsSchema,
  CreateEnvironmentSchema,
  GetEnvironmentSchema,
  DeleteEnvironmentSchema,
  ListEnvironmentAppsSchema,
  GetEnvironmentAppSchema,
  ListDeploymentZonesSchema,
  SetMaintenanceModeSchema,
  ListBlockedIpsSchema,
  UnblockIpSchema,
} from "../schemas.js";
import { MCPToolResult, runTool } from "../tool-helpers.js";

export const environmentsTools: Tool[] = [
  {
    name: "get_environments",
    description:
      "Lists all environments registered in the LifeTime infrastructure " +
      "(Development, Quality, Production, etc.) including their keys, hostnames, " +
      "platform versions and types. ALWAYS call this first to discover " +
      "EnvironmentKeys required by deployment and application tools.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "create_environment",
    description:
      "Registers a new environment in LifeTime so it becomes a target for deployments. " +
      "Requires the hostname of an already-installed OutSystems platform server.",
    inputSchema: {
      type: "object",
      properties: {
        Name: { type: "string", description: "Name of the new environment." },
        HostName: {
          type: "string",
          description: "Hostname or IP of the platform server.",
        },
        Type: {
          type: "string",
          description:
            'Environment type. Common values: "Development", "Quality", "Production".',
        },
      },
      required: ["Name", "HostName"],
    },
  },
  {
    name: "get_environment",
    description:
      "Returns the details of a single environment (key, name, hostname, type, " +
      "platform version, OS, etc.). Use get_environments to discover keys.",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description: "Unique key of the environment.",
        },
      },
      required: ["EnvironmentKey"],
    },
  },
  {
    name: "delete_environment",
    description:
      "Unregisters an environment from LifeTime. The OutSystems platform server itself " +
      "is NOT affected — this only removes it from the LifeTime deployment topology.",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description: "Unique key of the environment to unregister.",
        },
      },
      required: ["EnvironmentKey"],
    },
  },
  {
    name: "list_environment_apps",
    description:
      "Lists all applications currently running in a given environment, with their " +
      "running version keys and labels. Useful for snapshotting environment state.",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description: "Unique key of the environment.",
        },
      },
      required: ["EnvironmentKey"],
    },
  },
  {
    name: "get_environment_app",
    description:
      "Returns the running version of a specific application in a specific environment.",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description: "Unique key of the environment.",
        },
        ApplicationKey: {
          type: "string",
          description: "Unique key of the application.",
        },
      },
      required: ["EnvironmentKey", "ApplicationKey"],
    },
  },
  {
    name: "list_deployment_zones",
    description:
      "Lists all deployment zones available in an environment. Deployment zones are used " +
      "to route applications to different front-end servers within the same environment.",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description: "Unique key of the environment.",
        },
      },
      required: ["EnvironmentKey"],
    },
  },
  {
    name: "set_maintenance_mode",
    description:
      "Enables or disables maintenance mode on an environment. When enabled, end-users " +
      "see a maintenance page and most operations are paused. Use carefully on Production.",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description: "Unique key of the environment.",
        },
        Enabled: {
          type: "boolean",
          description: "True to enable maintenance mode; false to disable it.",
        },
      },
      required: ["EnvironmentKey", "Enabled"],
    },
  },
  {
    name: "list_blocked_ips",
    description:
      "Lists IP addresses currently blocked from logging in across the infrastructure " +
      "(typically auto-blocked after repeated failed login attempts).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "unblock_ip",
    description:
      "Unblocks a specific IP address that was previously blocked from login attempts.",
    inputSchema: {
      type: "object",
      properties: {
        IpAddress: {
          type: "string",
          description: "IP address to unblock.",
        },
      },
      required: ["IpAddress"],
    },
  },
];

export function environmentsHandlers(
  api: AxiosInstance
): Record<string, (args: unknown) => Promise<MCPToolResult>> {
  return {
    get_environments: async (args) => {
      GetEnvironmentsSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get("/environments/");
        return data;
      });
    },

    create_environment: async (args) => {
      const body = CreateEnvironmentSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.post("/environments/", body);
        return { EnvironmentKey: data };
      });
    },

    get_environment: async (args) => {
      const { EnvironmentKey } = GetEnvironmentSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(`/environments/${EnvironmentKey}/`);
        return data;
      });
    },

    delete_environment: async (args) => {
      const { EnvironmentKey } = DeleteEnvironmentSchema.parse(args);
      return runTool(async () => {
        await api.delete(`/environments/${EnvironmentKey}`);
        return `Environment ${EnvironmentKey} successfully unregistered.`;
      });
    },

    list_environment_apps: async (args) => {
      const { EnvironmentKey } = ListEnvironmentAppsSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(
          `/environments/${EnvironmentKey}/applications/`
        );
        return data;
      });
    },

    get_environment_app: async (args) => {
      const { EnvironmentKey, ApplicationKey } =
        GetEnvironmentAppSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(
          `/environments/${EnvironmentKey}/applications/${ApplicationKey}/`
        );
        return data;
      });
    },

    list_deployment_zones: async (args) => {
      const { EnvironmentKey } = ListDeploymentZonesSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(
          `/environments/${EnvironmentKey}/deploymentzones/`
        );
        return data;
      });
    },

    set_maintenance_mode: async (args) => {
      const { EnvironmentKey, Enabled } = SetMaintenanceModeSchema.parse(args);
      return runTool(async () => {
        await api.put(
          `/environments/${EnvironmentKey}/maintenancemode`,
          { Enabled }
        );
        return `Maintenance mode ${Enabled ? "enabled" : "disabled"} on environment ${EnvironmentKey}.`;
      });
    },

    list_blocked_ips: async (args) => {
      ListBlockedIpsSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get("/environments/blockedipaddresses/");
        return data;
      });
    },

    unblock_ip: async (args) => {
      const { IpAddress } = UnblockIpSchema.parse(args);
      return runTool(async () => {
        await api.delete(
          `/environments/blockedipaddresses/${encodeURIComponent(IpAddress)}/`
        );
        return `IP address ${IpAddress} successfully unblocked.`;
      });
    },
  };
}
