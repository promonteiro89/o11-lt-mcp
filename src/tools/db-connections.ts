import { AxiosInstance } from "axios";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  ListDbProvidersSchema,
  ListDbConnectionsSchema,
  CreateDbConnectionSchema,
  GetDbConnectionSchema,
  UpdateDbConnectionSchema,
  DeleteDbConnectionSchema,
  TestDbConnectionSchema,
  ManageDbConnectionRolePermissionSchema,
  GetDbConnectionRolePermissionSchema,
  ManageDbConnectionUserPermissionSchema,
  GetDbConnectionUserPermissionSchema,
  ListDbConnectionPermissionLevelsSchema,
} from "../schemas.js";
import { MCPToolResult, runTool } from "../tool-helpers.js";

const PAYLOAD_DESCRIPTION =
  "Object with the database connection configuration. Common fields: Name, " +
  "DatabaseProvider, Server, Database, Schema, Username, Password, Port, " +
  "AdditionalConnectionString. Exact required fields depend on the provider — " +
  "use list_db_connection_providers to discover them.";

export const dbConnectionsTools: Tool[] = [
  {
    name: "list_db_connection_providers",
    description:
      "Lists the database providers available in an environment (e.g. SqlServer, Oracle, MySQL). " +
      "Use this to discover valid DatabaseProvider keys before creating a connection.",
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
    name: "list_db_connections",
    description:
      "Lists all database connections configured in a specific environment.",
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
    name: "create_db_connection",
    description:
      "Creates a new database connection in an environment. The Payload object holds " +
      "the connection configuration; required fields depend on the DatabaseProvider. " +
      "Call list_db_connection_providers first to see what's supported.",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description: "Unique key of the environment.",
        },
        Payload: {
          type: "object",
          description: PAYLOAD_DESCRIPTION,
        },
      },
      required: ["EnvironmentKey", "Payload"],
    },
  },
  {
    name: "get_db_connection",
    description:
      "Returns the configuration details of a specific database connection. " +
      "Passwords are typically masked in the response.",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description: "Unique key of the environment.",
        },
        DbConnectionName: {
          type: "string",
          description: "Name of the database connection.",
        },
      },
      required: ["EnvironmentKey", "DbConnectionName"],
    },
  },
  {
    name: "update_db_connection",
    description:
      "Updates an existing database connection. Provide the full configuration in Payload " +
      "(LifeTime replaces the existing config wholesale).",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description: "Unique key of the environment.",
        },
        DbConnectionName: {
          type: "string",
          description: "Name of the database connection to update.",
        },
        Payload: {
          type: "object",
          description: PAYLOAD_DESCRIPTION,
        },
      },
      required: ["EnvironmentKey", "DbConnectionName", "Payload"],
    },
  },
  {
    name: "delete_db_connection",
    description:
      "Permanently deletes a database connection from an environment. " +
      "Applications using it will lose access — verify dependencies first.",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description: "Unique key of the environment.",
        },
        DbConnectionName: {
          type: "string",
          description: "Name of the database connection to delete.",
        },
      },
      required: ["EnvironmentKey", "DbConnectionName"],
    },
  },
  {
    name: "test_db_connection",
    description:
      "Tests a database connection configuration without persisting it. " +
      "Useful for validating credentials and reachability before calling create_db_connection.",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description: "Unique key of the environment.",
        },
        Payload: {
          type: "object",
          description: PAYLOAD_DESCRIPTION,
        },
      },
      required: ["EnvironmentKey", "Payload"],
    },
  },
  {
    name: "manage_db_connection_role_permission",
    description:
      "Assigns or revokes a role's permission level on a database connection.\n" +
      '• action="set"    → PUT /rolepermissionlevel/ (requires PermissionLevelKey)\n' +
      '• action="remove" → DELETE /rolepermissionlevel/\n' +
      "Use list_db_connection_permission_levels to discover valid levels.",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description: "Unique key of the environment.",
        },
        DbConnectionName: {
          type: "string",
          description: "Name of the database connection.",
        },
        action: {
          type: "string",
          enum: ["set", "remove"],
          description: '"set" to grant a permission; "remove" to revoke.',
        },
        RoleKey: { type: "string", description: "Unique key of the role." },
        PermissionLevelKey: {
          type: "string",
          description:
            'Permission level (e.g. "Read", "ReadWrite"). Required when action is "set".',
        },
      },
      required: ["EnvironmentKey", "DbConnectionName", "action", "RoleKey"],
    },
  },
  {
    name: "get_db_connection_role_permission",
    description:
      "Returns the permission level a specific role has on a database connection.",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description: "Unique key of the environment.",
        },
        DbConnectionName: {
          type: "string",
          description: "Name of the database connection.",
        },
        RoleKey: { type: "string", description: "Unique key of the role." },
      },
      required: ["EnvironmentKey", "DbConnectionName", "RoleKey"],
    },
  },
  {
    name: "manage_db_connection_user_permission",
    description:
      "Assigns or revokes a user's permission level on a database connection.\n" +
      '• action="set"    → PUT /userpermissionlevel/ (requires PermissionLevelKey)\n' +
      '• action="remove" → DELETE /userpermissionlevel/\n' +
      "Use list_db_connection_permission_levels to discover valid levels.",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description: "Unique key of the environment.",
        },
        DbConnectionName: {
          type: "string",
          description: "Name of the database connection.",
        },
        action: {
          type: "string",
          enum: ["set", "remove"],
          description: '"set" to grant a permission; "remove" to revoke.',
        },
        Username: { type: "string", description: "Username of the user." },
        PermissionLevelKey: {
          type: "string",
          description: 'Permission level. Required when action is "set".',
        },
      },
      required: [
        "EnvironmentKey",
        "DbConnectionName",
        "action",
        "Username",
      ],
    },
  },
  {
    name: "get_db_connection_user_permission",
    description:
      "Returns the permission level a specific user has on a database connection.",
    inputSchema: {
      type: "object",
      properties: {
        EnvironmentKey: {
          type: "string",
          description: "Unique key of the environment.",
        },
        DbConnectionName: {
          type: "string",
          description: "Name of the database connection.",
        },
        Username: { type: "string", description: "Username of the user." },
      },
      required: ["EnvironmentKey", "DbConnectionName", "Username"],
    },
  },
  {
    name: "list_db_connection_permission_levels",
    description:
      "Lists all valid permission-level keys that can be granted on database connections " +
      '(e.g. "None", "Read", "ReadWrite"). ' +
      "Call before manage_db_connection_role_permission or manage_db_connection_user_permission.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

export function dbConnectionsHandlers(
  api: AxiosInstance
): Record<string, (args: unknown) => Promise<MCPToolResult>> {
  return {
    list_db_connection_providers: async (args) => {
      const { EnvironmentKey } = ListDbProvidersSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(
          `/environments/${EnvironmentKey}/dbconnection/dbproviders/`
        );
        return data;
      });
    },

    list_db_connections: async (args) => {
      const { EnvironmentKey } = ListDbConnectionsSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(
          `/environments/${EnvironmentKey}/dbconnections/`
        );
        return data;
      });
    },

    create_db_connection: async (args) => {
      const { EnvironmentKey, Payload } = CreateDbConnectionSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.post(
          `/environments/${EnvironmentKey}/dbconnections/`,
          Payload
        );
        return data ?? { message: "Database connection created successfully." };
      });
    },

    get_db_connection: async (args) => {
      const { EnvironmentKey, DbConnectionName } =
        GetDbConnectionSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(
          `/environments/${EnvironmentKey}/dbconnections/${encodeURIComponent(DbConnectionName)}/`
        );
        return data;
      });
    },

    update_db_connection: async (args) => {
      const { EnvironmentKey, DbConnectionName, Payload } =
        UpdateDbConnectionSchema.parse(args);
      return runTool(async () => {
        await api.put(
          `/environments/${EnvironmentKey}/dbconnections/${encodeURIComponent(DbConnectionName)}/`,
          Payload
        );
        return `Database connection "${DbConnectionName}" successfully updated.`;
      });
    },

    delete_db_connection: async (args) => {
      const { EnvironmentKey, DbConnectionName } =
        DeleteDbConnectionSchema.parse(args);
      return runTool(async () => {
        await api.delete(
          `/environments/${EnvironmentKey}/dbconnections/${encodeURIComponent(DbConnectionName)}/`
        );
        return `Database connection "${DbConnectionName}" successfully deleted.`;
      });
    },

    test_db_connection: async (args) => {
      const { EnvironmentKey, Payload } = TestDbConnectionSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.post(
          `/environments/${EnvironmentKey}/testdbconnection/`,
          Payload
        );
        return data ?? { message: "Connection test succeeded." };
      });
    },

    manage_db_connection_role_permission: async (args) => {
      const {
        EnvironmentKey,
        DbConnectionName,
        action,
        RoleKey,
        PermissionLevelKey,
      } = ManageDbConnectionRolePermissionSchema.parse(args);

      const path = `/environments/${EnvironmentKey}/dbconnections/${encodeURIComponent(DbConnectionName)}/rolepermissionlevel/`;

      if (action === "set") {
        if (!PermissionLevelKey) {
          return {
            content: [
              {
                type: "text",
                text: 'Input validation failed:\n  • PermissionLevelKey: Required when action is "set".',
              },
            ],
            isError: true,
          };
        }
        return runTool(async () => {
          await api.put(path, { RoleKey, PermissionLevelKey });
          return `Role ${RoleKey} permission on "${DbConnectionName}" set to ${PermissionLevelKey}.`;
        });
      }

      // action === "remove"
      return runTool(async () => {
        await api.delete(path, { data: { RoleKey } });
        return `Role ${RoleKey} permission on "${DbConnectionName}" revoked.`;
      });
    },

    get_db_connection_role_permission: async (args) => {
      const { EnvironmentKey, DbConnectionName, RoleKey } =
        GetDbConnectionRolePermissionSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(
          `/environments/${EnvironmentKey}/dbconnections/${encodeURIComponent(DbConnectionName)}/rolepermissionlevel/${RoleKey}/`
        );
        return data;
      });
    },

    manage_db_connection_user_permission: async (args) => {
      const {
        EnvironmentKey,
        DbConnectionName,
        action,
        Username,
        PermissionLevelKey,
      } = ManageDbConnectionUserPermissionSchema.parse(args);

      const path = `/environments/${EnvironmentKey}/dbconnections/${encodeURIComponent(DbConnectionName)}/userpermissionlevel/`;

      if (action === "set") {
        if (!PermissionLevelKey) {
          return {
            content: [
              {
                type: "text",
                text: 'Input validation failed:\n  • PermissionLevelKey: Required when action is "set".',
              },
            ],
            isError: true,
          };
        }
        return runTool(async () => {
          await api.put(path, { Username, PermissionLevelKey });
          return `User ${Username} permission on "${DbConnectionName}" set to ${PermissionLevelKey}.`;
        });
      }

      // action === "remove"
      return runTool(async () => {
        await api.delete(path, { data: { Username } });
        return `User ${Username} permission on "${DbConnectionName}" revoked.`;
      });
    },

    get_db_connection_user_permission: async (args) => {
      const { EnvironmentKey, DbConnectionName, Username } =
        GetDbConnectionUserPermissionSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(
          `/environments/${EnvironmentKey}/dbconnections/${encodeURIComponent(DbConnectionName)}/userpermissionlevel/${encodeURIComponent(Username)}/`
        );
        return data;
      });
    },

    list_db_connection_permission_levels: async (args) => {
      ListDbConnectionPermissionLevelsSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get("/environments/dbconnection/permissionlevels/");
        return data;
      });
    },
  };
}
