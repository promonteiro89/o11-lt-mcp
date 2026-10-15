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
import { LifeTimeAPIError } from "../api-client.js";

/**
 * After create_deployment, LifeTime validates the plan in a background job.
 * For large plans (dozens of apps) that job can take tens of minutes, and
 * calling get_deployment or start while it runs fails with confusing errors.
 */
export const VALIDATION_HINT =
  "Hint: this deployment plan is most likely still being validated by LifeTime " +
  "(a background job that can take tens of minutes for plans with many applications). " +
  "The plan is not corrupted — do not discard or recreate it. Poll get_deployment_status " +
  "(it reports 'saved' while validation runs) and retry once validation has finished.";

/**
 * Returns `errors` with VALIDATION_HINT appended when they indicate the plan
 * is still validating; otherwise returns `errors` unchanged (same reference).
 */
export function addValidationHint(errors: string[], command?: string): string[] {
  const stillValidating = errors.some(
    (e) =>
      /from 'Validating'/i.test(e) ||
      (command === "start" && /Command 'start' can't be executed/i.test(e))
  );
  return stillValidating ? [...errors, VALIDATION_HINT] : errors;
}

async function explainValidating<T>(
  fn: () => Promise<T>,
  command?: string
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof LifeTimeAPIError) {
      const errors = addValidationHint(err.errors, command);
      if (errors !== err.errors) throw new LifeTimeAPIError(errors, err.statusCode);
    }
    throw err;
  }
}

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
      "  4. Wait for LifeTime to validate the plan (see below).\n" +
      "  5. Call execute_deployment_command with command='start' to begin the deployment.\n" +
      "  6. Poll get_deployment_status until DeploymentStatus is a terminal state.\n" +
      "Validation: LifeTime validates a new plan in a background job. For a few apps it is " +
      "near-instant, but for large plans (dozens of apps) it can take tens of minutes. While it " +
      "runs, get_deployment and 'start' fail (e.g. \"Invalid status change ... from 'Validating'\" " +
      "or \"Command 'start' can't be executed\"). Only get_deployment_status is safe to poll " +
      "meanwhile (it reports 'saved'). Do not discard/recreate the plan — it is not broken.",
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
      '  • "start"    — Begins the deployment (plan must be saved AND have finished validating).\n' +
      '  • "continue" — Resumes a deployment paused for user intervention (e.g. two-step deploy).\n' +
      '  • "abort"    — Cancels the deployment before it finishes deploying to the platform server.\n' +
      "After calling start or continue, poll get_deployment_status to monitor progress.\n" +
      "If 'start' fails with \"Command 'start' can't be executed\" (or a bare 500) shortly after " +
      "create_deployment on a large plan, LifeTime is most likely still validating it — wait " +
      "(polling get_deployment_status, not this command) and retry; do not recreate the plan.",
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
      "  • saved                 — plan created but not started (also reported while LifeTime is still validating a new plan)\n" +
      "  • running               — deployment is in progress\n" +
      "  • needs_user_intervention — paused; call execute_deployment_command with 'continue'\n" +
      "  • finished_successful   — deployment completed without issues\n" +
      "  • finished_with_warnings / finished_with_errors — completed with issues\n" +
      "  • aborted               — deployment was aborted\n" +
      "This is the only deployment call that is safe to poll while a freshly created plan is still being validated.",
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
      "Unlike get_deployment_status, this does not include live execution logs. " +
      "Fails with \"Invalid status change ... from 'Validating'\" while LifeTime is still validating " +
      "a freshly created plan (can take tens of minutes for large plans) — poll get_deployment_status instead until then.",
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
            "Deployment plan created. LifeTime now validates it in the background (can take tens of " +
            "minutes for plans with many applications). Poll get_deployment_status until validation " +
            "finishes, then call execute_deployment_command with command='start'.",
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

        await explainValidating(
          () =>
            api.post(`/deployments/${DeploymentKey}/${Command}/`, null, {
              params,
            }),
          Command
        );
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
        const { data } = await explainValidating(() =>
          api.get(`/deployments/${DeploymentKey}/`)
        );
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
