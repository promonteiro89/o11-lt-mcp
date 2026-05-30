import { AxiosInstance } from "axios";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  DeleteTeamSchema,
  CreateTeamSchema,
  ListTeamsSchema,
  ManageTeamUsersSchema,
  ManageTeamAppsSchema,
  GetTeamSchema,
  UpdateTeamSchema,
} from "../schemas.js";
import { MCPToolResult, runTool } from "../tool-helpers.js";

export const teamsTools: Tool[] = [
  {
    name: "delete_team",
    description: "Permanently deletes a team from LifeTime. Use list_teams to find the TeamKey.",
    inputSchema: {
      type: "object",
      properties: {
        TeamKey: { type: "string", description: "Unique identifier of the team to delete." },
      },
      required: ["TeamKey"],
    },
  },
  {
    name: "create_team",
    description:
      "Creates a new team in LifeTime with the given name and optional description. " +
      "Returns the full Team record including the new TeamKey. " +
      "After creation, use manage_team_users and manage_team_apps to populate it.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Unique name for the new team.",
        },
        description: {
          type: "string",
          description: "Optional description of the team's purpose.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "list_teams",
    description:
      "Lists all teams defined in LifeTime, including their keys, names and descriptions. " +
      "Use IncludeUsers=true and/or IncludeApplications=true to get member and application lists. " +
      "Team Keys are required by manage_team_users and manage_team_apps.",
    inputSchema: {
      type: "object",
      properties: {
        IncludeUsers: {
          type: "boolean",
          description:
            "When true, the list of users (with their roles) belonging to each team is included.",
        },
        IncludeApplications: {
          type: "boolean",
          description:
            "When true, the list of applications belonging to each team is included.",
        },
      },
      required: [],
    },
  },
  {
    name: "manage_team_users",
    description:
      'Adds or removes a user from a team.\n' +
      '• action="add"    → POST /teams/{TeamKey}/users/  (requires RoleKey)\n' +
      '• action="remove" → DELETE /teams/{TeamKey}/users/{UserKey}/\n' +
      "Use list_teams to find TeamKey and list_users to find UserKey.",
    inputSchema: {
      type: "object",
      properties: {
        TeamKey: {
          type: "string",
          description: "Unique identifier of the team.",
        },
        action: {
          type: "string",
          enum: ["add", "remove"],
          description: '"add" to add the user to the team; "remove" to remove.',
        },
        UserKey: {
          type: "string",
          description: "Unique identifier of the user.",
        },
        RoleKey: {
          type: "string",
          description:
            'Role key to grant the user within the team. Required when action is "add".',
        },
      },
      required: ["TeamKey", "action", "UserKey"],
    },
  },
  {
    name: "manage_team_apps",
    description:
      'Adds or removes an application from a team.\n' +
      '• action="add"    → POST /teams/{TeamKey}/applications/\n' +
      '• action="remove" → DELETE /teams/{TeamKey}/applications/{ApplicationKey}\n' +
      "Use list_teams for TeamKey and get_applications for ApplicationKey.",
    inputSchema: {
      type: "object",
      properties: {
        TeamKey: {
          type: "string",
          description: "Unique identifier of the team.",
        },
        action: {
          type: "string",
          enum: ["add", "remove"],
          description:
            '"add" to add the application to the team; "remove" to remove it.',
        },
        ApplicationKey: {
          type: "string",
          description: "Unique identifier of the application.",
        },
      },
      required: ["TeamKey", "action", "ApplicationKey"],
    },
  },
  {
    name: "get_team",
    description:
      "Returns the full details of a single team (name, description, members, applications). " +
      "Use list_teams to find TeamKeys.",
    inputSchema: {
      type: "object",
      properties: {
        TeamKey: { type: "string", description: "Unique key of the team." },
      },
      required: ["TeamKey"],
    },
  },
  {
    name: "update_team",
    description:
      "Updates an existing team's name and/or description. Membership and application " +
      "associations are managed separately via manage_team_users and manage_team_apps.",
    inputSchema: {
      type: "object",
      properties: {
        TeamKey: {
          type: "string",
          description: "Unique key of the team to update.",
        },
        name: { type: "string", description: "Updated team name." },
        description: {
          type: "string",
          description: "Updated team description.",
        },
      },
      required: ["TeamKey", "name"],
    },
  },
];

export function teamsHandlers(
  api: AxiosInstance
): Record<string, (args: unknown) => Promise<MCPToolResult>> {
  return {
    delete_team: async (args) => {
      const { TeamKey } = DeleteTeamSchema.parse(args);
      return runTool(async () => {
        await api.delete(`/teams/${TeamKey}/`);
        return `Team ${TeamKey} successfully deleted.`;
      });
    },

    create_team: async (args) => {
      const body = CreateTeamSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.post("/teams/", body);
        return data;
      });
    },

    list_teams: async (args) => {
      const params = ListTeamsSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get("/teams/", { params });
        return data;
      });
    },

    manage_team_users: async (args) => {
      const { TeamKey, action, UserKey, RoleKey } =
        ManageTeamUsersSchema.parse(args);

      if (action === "add") {
        if (!RoleKey) {
          return {
            content: [
              {
                type: "text",
                text: 'Input validation failed:\n  • RoleKey: Required when action is "add".',
              },
            ],
            isError: true,
          };
        }
        return runTool(async () => {
          await api.post(`/teams/${TeamKey}/users/`, {
            userKey: UserKey,
            roleKey: RoleKey,
          });
          return `User ${UserKey} successfully added to team ${TeamKey} with role ${RoleKey}.`;
        });
      }

      // action === "remove"
      return runTool(async () => {
        await api.delete(`/teams/${TeamKey}/users/${UserKey}/`);
        return `User ${UserKey} successfully removed from team ${TeamKey}.`;
      });
    },

    manage_team_apps: async (args) => {
      const { TeamKey, action, ApplicationKey } =
        ManageTeamAppsSchema.parse(args);

      if (action === "add") {
        return runTool(async () => {
          await api.post(`/teams/${TeamKey}/applications/`, {
            ApplicationKey,
          });
          return `Application ${ApplicationKey} successfully added to team ${TeamKey}.`;
        });
      }

      // action === "remove"
      return runTool(async () => {
        await api.delete(`/teams/${TeamKey}/applications/${ApplicationKey}`);
        return `Application ${ApplicationKey} successfully removed from team ${TeamKey}.`;
      });
    },

    get_team: async (args) => {
      const { TeamKey } = GetTeamSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(`/teams/${TeamKey}`);
        return data;
      });
    },

    update_team: async (args) => {
      const { TeamKey, ...body } = UpdateTeamSchema.parse(args);
      return runTool(async () => {
        await api.put(`/teams/${TeamKey}`, body);
        return `Team ${TeamKey} successfully updated.`;
      });
    },
  };
}
