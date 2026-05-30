import { AxiosInstance } from "axios";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  ListDeploymentsSchema,
  CreateDeploymentSchema,
  ExecuteDeploymentCommandSchema,
  GetDeploymentStatusSchema,
  GetDeploymentSchema,
  UpdateDeploymentSchema,
  DeleteDeploymentSchema,
} from "../schemas.js";
import { MCPToolResult, runTool } from "../tool-helpers.js";

export const deploymentsTools: Tool[] = [
  {
    name: "list_deployments",
    description:
      "Returns a list of deployments ordered by creation date (newest first). " +
      "Filter by date range and/or target environment. " +
      "Each record includes the deployment Key needed by execute_deployment_command and get_deployment_status.",
    inputSchema: {
      type: "object",
      properties: {
        MinDate: {
          type: "string",
          description:
            "Earliest creation date to include (YYYY-MM-DD). Defaults to 1 week ago.",
        },
        MaxDate: {
          type: "string",
          description:
            "Latest creation date to include (YYYY-MM-DD). Defaults to today.",
        },
        TargetEnvironmentKey: {
          type: "string",
          description:
            "Filter results to a specific target environment. Leave empty for all.",
        },
      },
      required: [],
    },
  },
  {
    name: "create_deployment",
    description:
      "Creates a new deployment plan from a source environment to a target environment. " +
      "You must supply at least one ApplicationOperation with an ApplicationVersionKey. " +
      "Step-by-step workflow:\n" +
      "  1. Call get_environments to find SourceEnvironmentKey and TargetEnvironmentKey.\n" +
      "  2. Call get_applications (IncludeEnvStatus=true) to find ApplicationVersionKeys.\n" +
      "  3. Call create_deployment with those keys.\n" +
      "  4. Call execute_deployment_command with command='start' to begin the deployment.\n" +
      "  5. Poll get_deployment_status until DeploymentStatus is a terminal state.",
    inputSchema: {
      type: "object",
      properties: {
        SourceEnvironmentKey: {
          type: "string",
          description: "Key of the environment to deploy FROM.",
        },
        TargetEnvironmentKey: {
          type: "string",
          description: "Key of the environment to deploy TO.",
        },
        Notes: {
          type: "string",
          description: "Optional deployment notes / change description.",
        },
        ApplicationOperations: {
          type: "array",
          description:
            "One entry per application version to include in this deployment plan.",
          items: {
            type: "object",
            properties: {
              ApplicationVersionKey: {
                type: "string",
                description:
                  "The exact version key to deploy. Obtain from get_applications with IncludeEnvStatus=true.",
              },
              DeploymentZoneKey: {
                type: "string",
                description:
                  "Deployment zone key. Use empty string for the environment default zone.",
              },
            },
            required: ["ApplicationVersionKey"],
          },
          minItems: 1,
        },
      },
      required: [
        "SourceEnvironmentKey",
        "TargetEnvironmentKey",
        "ApplicationOperations",
      ],
    },
  },
  {
    name: "execute_deployment_command",
    description:
      "Executes a lifecycle command on an existing deployment plan:\n" +
      '  • "start"    — Begins the deployment (plan must be in saved/valid state).\n' +
      '  • "continue" — Resumes a deployment paused for user intervention (e.g. two-step deploy).\n' +
      '  • "abort"    — Cancels the deployment before it finishes deploying to the platform server.\n' +
      "After calling start or continue, poll get_deployment_status to monitor progress.",
    inputSchema: {
      type: "object",
      properties: {
        DeploymentKey: {
          type: "string",
          description: "Unique identifier of the deployment plan.",
        },
        Command: {
          type: "string",
          enum: ["start", "continue", "abort"],
          description: "The command to execute on the deployment.",
        },
        RedeployOutdated: {
          type: "boolean",
          description:
            "If true, outdated applications in the target environment are also redeployed.",
        },
        IncludeErrorDetails: {
          type: "boolean",
          description:
            "If true, error messages include extended detail when a problem occurs.",
        },
      },
      required: ["DeploymentKey", "Command"],
    },
  },
  {
    name: "get_deployment_status",
    description:
      "Polls the execution status of a running (or completed) deployment. " +
      "Returns DeploymentStatus, Info (e.g. action needed for two-step deployments), " +
      "and a timestamped DeploymentLog with Info/Warning/Error messages.\n\n" +
      "Key status values:\n" +
      "  • running               — deployment is in progress\n" +
      "  • needs_user_intervention — paused; call execute_deployment_command with 'continue'\n" +
      "  • finished_successful   — deployment completed without issues\n" +
      "  • finished_with_warnings / finished_with_errors — completed with issues\n" +
      "  • aborted               — deployment was aborted",
    inputSchema: {
      type: "object",
      properties: {
        DeploymentKey: {
          type: "string",
          description: "Unique identifier of the deployment to check.",
        },
      },
      required: ["DeploymentKey"],
    },
  },
  {
    name: "get_deployment",
    description:
      "Returns the full details of a deployment plan: source/target environments, notes, " +
      "creator, lifecycle timestamps, and the list of ApplicationOperations. " +
      "Unlike get_deployment_status, this does not include live execution logs.",
    inputSchema: {
      type: "object",
      properties: {
        DeploymentKey: {
          type: "string",
          description: "Unique key of the deployment plan.",
        },
      },
      required: ["DeploymentKey"],
    },
  },
  {
    name: "update_deployment",
    description:
      "Updates a deployment plan that has NOT yet been started — typically used to amend " +
      "the application operation list or notes before calling execute_deployment_command='start'. " +
      "Will fail if the deployment has already been started, completed, or aborted.",
    inputSchema: {
      type: "object",
      properties: {
        DeploymentKey: {
          type: "string",
          description: "Unique key of the deployment plan to update.",
        },
        Notes: { type: "string", description: "Updated deployment notes." },
        ApplicationOperations: {
          type: "array",
          description: "Updated list of application versions.",
          items: {
            type: "object",
            properties: {
              ApplicationVersionKey: {
                type: "string",
                description: "The exact version key to deploy.",
              },
              DeploymentZoneKey: {
                type: "string",
                description:
                  "Deployment zone key. Use empty string for the environment default zone.",
              },
            },
            required: ["ApplicationVersionKey"],
          },
          minItems: 1,
        },
      },
      required: ["DeploymentKey", "ApplicationOperations"],
    },
  },
  {
    name: "delete_deployment",
    description:
      "Discards a deployment plan. Only allowed for plans that have not started, " +
      "or have already finished. Cannot delete an in-progress deployment — use " +
      "execute_deployment_command with command='abort' instead.",
    inputSchema: {
      type: "object",
      properties: {
        DeploymentKey: {
          type: "string",
          description: "Unique key of the deployment plan to delete.",
        },
      },
      required: ["DeploymentKey"],
    },
  },
];

export function deploymentsHandlers(
  api: AxiosInstance
): Record<string, (args: unknown) => Promise<MCPToolResult>> {
  return {
    list_deployments: async (args) => {
      const params = ListDeploymentsSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get("/deployments/", { params });
        return data;
      });
    },

    create_deployment: async (args) => {
      const {
        SourceEnvironmentKey,
        TargetEnvironmentKey,
        Notes,
        ApplicationOperations,
      } = CreateDeploymentSchema.parse(args);

      return runTool(async () => {
        const payload = {
          SourceEnvironmentKey,
          TargetEnvironmentKey,
          Notes: Notes ?? "",
          ApplicationOperations: ApplicationOperations.map((op) => ({
            ApplicationVersionKey: op.ApplicationVersionKey,
            DeploymentZoneKey: op.DeploymentZoneKey ?? "",
          })),
        };
        const { data } = await api.post("/deployments/", payload);
        // LifeTime returns the new DeploymentKey as plain text
        return {
          DeploymentKey: data,
          message:
            "Deployment plan created. Call execute_deployment_command with command='start' to begin.",
        };
      });
    },

    execute_deployment_command: async (args) => {
      const { DeploymentKey, Command, RedeployOutdated, IncludeErrorDetails } =
        ExecuteDeploymentCommandSchema.parse(args);

      return runTool(async () => {
        const params: Record<string, boolean> = {};
        if (RedeployOutdated !== undefined)
          params.RedeployOutdated = RedeployOutdated;
        if (IncludeErrorDetails !== undefined)
          params.IncludeErrorDetails = IncludeErrorDetails;

        await api.post(`/deployments/${DeploymentKey}/${Command}/`, null, {
          params,
        });
        return {
          message: `Command '${Command}' accepted for deployment ${DeploymentKey}. Use get_deployment_status to monitor progress.`,
        };
      });
    },

    get_deployment_status: async (args) => {
      const { DeploymentKey } = GetDeploymentStatusSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(`/deployments/${DeploymentKey}/status/`);
        return data;
      });
    },

    get_deployment: async (args) => {
      const { DeploymentKey } = GetDeploymentSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(`/deployments/${DeploymentKey}/`);
        return data;
      });
    },

    update_deployment: async (args) => {
      const { DeploymentKey, Notes, ApplicationOperations } =
        UpdateDeploymentSchema.parse(args);
      return runTool(async () => {
        await api.put(`/deployments/${DeploymentKey}/`, {
          Notes: Notes ?? "",
          ApplicationOperations: ApplicationOperations.map((op) => ({
            ApplicationVersionKey: op.ApplicationVersionKey,
            DeploymentZoneKey: op.DeploymentZoneKey ?? "",
          })),
        });
        return `Deployment plan ${DeploymentKey} successfully updated.`;
      });
    },

    delete_deployment: async (args) => {
      const { DeploymentKey } = DeleteDeploymentSchema.parse(args);
      return runTool(async () => {
        await api.delete(`/deployments/${DeploymentKey}/`);
        return `Deployment plan ${DeploymentKey} successfully deleted.`;
      });
    },
  };
}
