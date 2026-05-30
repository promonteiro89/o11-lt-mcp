import { AxiosInstance } from "axios";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  CleanupOldDeploymentPlansSchema,
  GetApplicationDependenciesSchema,
  GetApplicationConsumersSchema,
} from "../schemas.js";
import { MCPToolResult, runTool } from "../tool-helpers.js";
import { LifeTimeAPIError } from "../api-client.js";

interface RawModule {
  Key: string;
  Name: string;
  ApplicationKey?: string;
  ApplicationName?: string;
  Kind?: string;
}

interface RawDeployment {
  Key: string;
  CreatedOn?: string;
  CreatedBy?: { Name?: string } | string;
  Status?: string;
  TargetEnvironmentKey?: string;
}

export const operationsTools: Tool[] = [
  {
    name: "cleanup_old_deployment_plans",
    description:
      "Bulk-discards SAVED (never-started) deployment plans older than a configurable threshold. " +
      "Defaults to DryRun=true and 30 days old, so by default it just reports the candidates without deleting. " +
      "Set DryRun=false to actually delete. " +
      "Never touches plans that are running, finished, or aborted — only deletes plans in 'saved' state. " +
      "Plans the service account does not have permission to delete are reported as failures.",
    inputSchema: {
      type: "object",
      properties: {
        OlderThanDays: {
          type: "number",
          description: "Discard saved plans older than N days (default 30).",
        },
        DryRun: {
          type: "boolean",
          description:
            "If true (default), preview the candidates without deleting them.",
        },
        TargetEnvironmentKey: {
          type: "string",
          description:
            "Optional: limit to plans targeting this environment.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_application_dependencies",
    description:
      "Returns the dependency footprint of an application: which OTHER applications/modules " +
      "are consumed by this app's modules. Critical for impact analysis before refactoring or deletion. " +
      "Best-effort: relies on whether the LifeTime API exposes module references for your factory; " +
      "if module-version detail doesn't include references, the result will be empty.",
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
    name: "get_application_consumers",
    description:
      "Returns which OTHER applications consume modules from this application — answers " +
      "\"who depends on me?\". Critical safety check before refactoring or deleting an app. " +
      "NOTE: iterates across every module in the infrastructure and can be slow for large factories (hundreds of modules).",
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
];

/**
 * Helper: list all modules in the infrastructure.
 */
async function listAllModules(api: AxiosInstance): Promise<RawModule[]> {
  const { data } = await api.get("/modules/");
  return Array.isArray(data) ? (data as RawModule[]) : [];
}

/**
 * Helper: get the latest version detail for a module, returning any consumed-module references
 * it exposes. The shape varies across LifeTime versions, so we look at a few candidate field names.
 */
async function getModuleConsumedModuleKeys(
  api: AxiosInstance,
  moduleKey: string
): Promise<string[]> {
  try {
    const { data: versions } = await api.get(`/modules/${moduleKey}/versions/`);
    if (!Array.isArray(versions) || versions.length === 0) return [];
    const latest = versions[0];
    const versionKey = latest?.Key;
    if (!versionKey) return [];

    const { data: detail } = await api.get(
      `/modules/${moduleKey}/versions/${versionKey}/`
    );
    const candidates: any[] =
      detail?.Modules ??
      detail?.ConsumedModules ??
      detail?.ReferencedModules ??
      [];
    const keys: string[] = [];
    for (const c of candidates) {
      const k = c?.ModuleKey ?? c?.Key ?? c;
      if (typeof k === "string" && k.length > 0) keys.push(k);
    }
    return keys;
  } catch {
    return [];
  }
}

export function operationsHandlers(
  api: AxiosInstance
): Record<string, (args: unknown) => Promise<MCPToolResult>> {
  return {
    cleanup_old_deployment_plans: async (args) => {
      const { OlderThanDays, DryRun, TargetEnvironmentKey } =
        CleanupOldDeploymentPlansSchema.parse(args);

      return runTool(async () => {
        // Compute upper bound for "old" plans
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - OlderThanDays);
        const maxDate = threshold.toISOString().split("T")[0];
        const minDate = "2000-01-01"; // far in the past — get all

        const params: Record<string, string> = {
          MinDate: minDate,
          MaxDate: maxDate,
        };
        if (TargetEnvironmentKey)
          params.TargetEnvironmentKey = TargetEnvironmentKey;

        const { data } = await api.get("/deployments/", { params });
        const deployments: RawDeployment[] = Array.isArray(data) ? data : [];

        // Only "saved" plans are safe to delete — never touch running or finished ones
        const candidates = deployments.filter((d) => {
          const status = (d.Status ?? "").toString().toLowerCase();
          return status === "saved";
        });

        if (DryRun) {
          return {
            dryRun: true,
            threshold: maxDate,
            wouldDelete: candidates.length,
            candidates: candidates.map((d) => ({
              DeploymentKey: d.Key,
              CreatedOn: d.CreatedOn,
              CreatedBy:
                typeof d.CreatedBy === "object"
                  ? d.CreatedBy?.Name
                  : d.CreatedBy,
              Status: d.Status,
              TargetEnvironmentKey: d.TargetEnvironmentKey,
            })),
            note: "Set DryRun=false to actually delete these plans.",
          };
        }

        const deleted: string[] = [];
        const failed: Array<{ DeploymentKey: string; error: string }> = [];

        for (const d of candidates) {
          try {
            await api.delete(`/deployments/${d.Key}/`);
            deleted.push(d.Key);
          } catch (err) {
            const msg =
              err instanceof LifeTimeAPIError
                ? err.errors.join("; ")
                : err instanceof Error
                  ? err.message
                  : String(err);
            failed.push({ DeploymentKey: d.Key, error: msg });
          }
        }

        return {
          dryRun: false,
          threshold: maxDate,
          deletedCount: deleted.length,
          failedCount: failed.length,
          deleted,
          failed,
        };
      });
    },

    get_application_dependencies: async (args) => {
      const { ApplicationKey } = GetApplicationDependenciesSchema.parse(args);
      return runTool(async () => {
        const modules = await listAllModules(api);
        const ownModules = modules.filter(
          (m) => m.ApplicationKey === ApplicationKey
        );
        if (ownModules.length === 0) {
          return {
            ApplicationKey,
            ownModuleCount: 0,
            note: "No modules found for this application.",
          };
        }

        const moduleByKey = new Map<string, RawModule>(
          modules.map((m) => [m.Key, m])
        );

        const consumedKeys = new Set<string>();
        for (const m of ownModules) {
          const refs = await getModuleConsumedModuleKeys(api, m.Key);
          for (const k of refs) {
            if (k !== m.Key) consumedKeys.add(k);
          }
        }

        // Group consumed modules by their parent application (excluding self)
        const appBuckets = new Map<
          string,
          { ApplicationKey: string; ApplicationName: string; Modules: Array<{ ModuleKey: string; ModuleName: string }> }
        >();
        const orphanModules: string[] = [];

        for (const k of consumedKeys) {
          const m = moduleByKey.get(k);
          if (!m) {
            orphanModules.push(k);
            continue;
          }
          if (m.ApplicationKey === ApplicationKey) continue; // internal
          if (!m.ApplicationKey) {
            orphanModules.push(k);
            continue;
          }
          const bucket = appBuckets.get(m.ApplicationKey) ?? {
            ApplicationKey: m.ApplicationKey,
            ApplicationName: m.ApplicationName ?? "(unknown)",
            Modules: [],
          };
          bucket.Modules.push({ ModuleKey: m.Key, ModuleName: m.Name });
          appBuckets.set(m.ApplicationKey, bucket);
        }

        return {
          ApplicationKey,
          ownModuleCount: ownModules.length,
          dependsOnApplicationCount: appBuckets.size,
          dependsOn: Array.from(appBuckets.values()),
          orphanModuleKeys: orphanModules,
          note:
            "Dependency data is best-effort. If empty, the LifeTime API likely doesn't expose " +
            "module references on its module-version endpoint for this infrastructure.",
        };
      });
    },

    get_application_consumers: async (args) => {
      const { ApplicationKey } = GetApplicationConsumersSchema.parse(args);
      return runTool(async () => {
        const modules = await listAllModules(api);
        const ownModuleKeys = new Set(
          modules
            .filter((m) => m.ApplicationKey === ApplicationKey)
            .map((m) => m.Key)
        );
        if (ownModuleKeys.size === 0) {
          return {
            ApplicationKey,
            ownModuleCount: 0,
            consumers: [],
            note: "No modules found for this application.",
          };
        }

        const externalModules = modules.filter(
          (m) => m.ApplicationKey !== ApplicationKey
        );

        // For each external module, check if any of its references hit one of our modules
        const consumerApps = new Map<
          string,
          {
            ApplicationKey: string;
            ApplicationName: string;
            ConsumingModules: Array<{ ModuleKey: string; ModuleName: string }>;
          }
        >();

        for (const m of externalModules) {
          const refs = await getModuleConsumedModuleKeys(api, m.Key);
          const hits = refs.some((k) => ownModuleKeys.has(k));
          if (!hits) continue;
          if (!m.ApplicationKey) continue;
          const bucket = consumerApps.get(m.ApplicationKey) ?? {
            ApplicationKey: m.ApplicationKey,
            ApplicationName: m.ApplicationName ?? "(unknown)",
            ConsumingModules: [],
          };
          bucket.ConsumingModules.push({
            ModuleKey: m.Key,
            ModuleName: m.Name,
          });
          consumerApps.set(m.ApplicationKey, bucket);
        }

        return {
          ApplicationKey,
          ownModuleCount: ownModuleKeys.size,
          consumerApplicationCount: consumerApps.size,
          consumers: Array.from(consumerApps.values()),
          note:
            "Consumer data is best-effort and slow (scans every module in the infrastructure). " +
            "If empty, the LifeTime API likely doesn't expose module references on its " +
            "module-version endpoint for this infrastructure.",
        };
      });
    },
  };
}
