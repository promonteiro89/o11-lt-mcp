import { AxiosInstance } from "axios";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  ListUsersSchema,
  CreateUserSchema,
  UpdateUserSchema,
  GetUserSchema,
  ManageUserAppRoleSchema,
  GetUserBlockedLoginsSchema,
  UnblockUserLoginsSchema,
} from "../schemas.js";
import { MCPToolResult, runTool } from "../tool-helpers.js";

export const usersTools: Tool[] = [
  {
    name: "list_users",
    description:
      "Lists all IT users in the LifeTime infrastructure. By default returns " +
      "only active users. Use IncludeInactive=true to include deactivated accounts. " +
      "Use IncludeTeams and IncludeApplicationRoles to enrich the response.",
    inputSchema: {
      type: "object",
      properties: {
        IncludeInactive: {
          type: "boolean",
          description: "When true, inactive users are also returned.",
        },
        IncludeTeams: {
          type: "boolean",
          description: "When true, the teams each user belongs to are included.",
        },
        IncludeApplicationRoles: {
          type: "boolean",
          description:
            "When true, application-level role assignments are included for each user.",
        },
      },
      required: [],
    },
  },
  {
    name: "create_user",
    description:
      "Creates a new IT user in LifeTime with the given credentials and role. " +
      "Returns the new user's Key on success. " +
      "To associate teams or application permissions afterwards, use manage_team_users.",
    inputSchema: {
      type: "object",
      properties: {
        Username: {
          type: "string",
          description: "Unique login username for the new user.",
        },
        Name: {
          type: "string",
          description: "Full display name.",
        },
        Email: {
          type: "string",
          description: "Valid email address.",
        },
        IsActive: {
          type: "boolean",
          description: "Whether the account is active (default: true).",
        },
        RoleKey: {
          type: "string",
          description: "LifeTime role key to assign. Determines base permissions.",
        },
      },
      required: ["Username", "Name", "Email", "RoleKey"],
    },
  },
  {
    name: "update_user",
    description:
      "Updates the details of an existing IT user (name, email, role, active status). " +
      "Use list_users first to obtain the UserKey. " +
      "Team and application associations are managed separately via manage_team_users.",
    inputSchema: {
      type: "object",
      properties: {
        UserKey: {
          type: "string",
          description: "Unique identifier of the user to update.",
        },
        Username: {
          type: "string",
          description: "Login username.",
        },
        Name: {
          type: "string",
          description: "Full display name.",
        },
        Email: {
          type: "string",
          description: "Email address.",
        },
        IsActive: {
          type: "boolean",
          description: "Active status of the account.",
        },
        RoleKey: {
          type: "string",
          description: "LifeTime role key to assign.",
        },
      },
      required: ["UserKey", "Username", "Name", "Email", "IsActive", "RoleKey"],
    },
  },
  {
    name: "get_user",
    description:
      "Returns the full details of a single user (name, email, role, teams, " +
      "application-level roles). Use list_users to find UserKeys.",
    inputSchema: {
      type: "object",
      properties: {
        UserKey: { type: "string", description: "Unique key of the user." },
      },
      required: ["UserKey"],
    },
  },
  {
    name: "manage_user_app_role",
    description:
      "Sets or removes a user's role for a specific application.\n" +
      '• action="set"    → POST /users/{UserKey}/applications/ (requires RoleKey, adds or updates)\n' +
      '• action="remove" → DELETE /users/{UserKey}/applications/{ApplicationKey}\n' +
      "Use list_users to find UserKeys, get_applications to find ApplicationKeys, " +
      "and list_roles to find valid RoleKeys.",
    inputSchema: {
      type: "object",
      properties: {
        UserKey: { type: "string", description: "Unique key of the user." },
        action: {
          type: "string",
          enum: ["set", "remove"],
          description:
            '"set" to assign or update the role; "remove" to revoke it.',
        },
        ApplicationKey: {
          type: "string",
          description: "Unique key of the application.",
        },
        RoleKey: {
          type: "string",
          description: 'Role key to assign. Required when action is "set".',
        },
      },
      required: ["UserKey", "action", "ApplicationKey"],
    },
  },
  {
    name: "get_user_blocked_logins",
    description:
      "Returns the list of blocked login attempts for a user (typically after too many " +
      "failed password attempts).",
    inputSchema: {
      type: "object",
      properties: {
        UserKey: { type: "string", description: "Unique key of the user." },
      },
      required: ["UserKey"],
    },
  },
  {
    name: "unblock_user_logins",
    description:
      "Clears all blocked login attempts for a user, allowing them to log in again.",
    inputSchema: {
      type: "object",
      properties: {
        UserKey: {
          type: "string",
          description: "Unique key of the user to unblock.",
        },
      },
      required: ["UserKey"],
    },
  },
];

export function usersHandlers(
  api: AxiosInstance
): Record<string, (args: unknown) => Promise<MCPToolResult>> {
  return {
    list_users: async (args) => {
      const params = ListUsersSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get("/users/", { params });
        return data;
      });
    },

    create_user: async (args) => {
      const body = CreateUserSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.post("/users/", body);
        return { UserKey: data };
      });
    },

    update_user: async (args) => {
      const { UserKey, ...body } = UpdateUserSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.put(`/users/${UserKey}/`, body);
        return { UserKey: data };
      });
    },

    get_user: async (args) => {
      const { UserKey } = GetUserSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(`/users/${UserKey}`);
        return data;
      });
    },

    manage_user_app_role: async (args) => {
      const { UserKey, action, ApplicationKey, RoleKey } =
        ManageUserAppRoleSchema.parse(args);

      if (action === "set") {
        if (!RoleKey) {
          return {
            content: [
              {
                type: "text",
                text: 'Input validation failed:\n  • RoleKey: Required when action is "set".',
              },
            ],
            isError: true,
          };
        }
        return runTool(async () => {
          await api.post(`/users/${UserKey}/applications/`, {
            ApplicationKey,
            RoleKey,
          });
          return `User ${UserKey} role for application ${ApplicationKey} set to ${RoleKey}.`;
        });
      }

      // action === "remove"
      return runTool(async () => {
        await api.delete(`/users/${UserKey}/applications/${ApplicationKey}`);
        return `User ${UserKey} role for application ${ApplicationKey} removed.`;
      });
    },

    get_user_blocked_logins: async (args) => {
      const { UserKey } = GetUserBlockedLoginsSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(`/users/${UserKey}/blockedlogins/`);
        return data;
      });
    },

    unblock_user_logins: async (args) => {
      const { UserKey } = UnblockUserLoginsSchema.parse(args);
      return runTool(async () => {
        await api.delete(`/users/${UserKey}/blockedlogins/`);
        return `Blocked logins for user ${UserKey} successfully cleared.`;
      });
    },
  };
}
