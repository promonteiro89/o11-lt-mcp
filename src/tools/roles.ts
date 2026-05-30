import { AxiosInstance } from "axios";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  ListRolesSchema,
  GetRoleSchema,
  CreateRoleSchema,
  UpdateRoleSchema,
  DeleteRoleSchema,
  ListRolePermissionLevelsSchema,
} from "../schemas.js";
import { MCPToolResult, runTool } from "../tool-helpers.js";

const PERMISSIONS_DESCRIPTION =
  "Object describing the permission flags and per-environment permission levels. " +
  "Use list_role_permission_levels to discover valid permission-level keys " +
  '(e.g. "None", "List", "Read", "Open", "Change&Deploy"). ' +
  "Common boolean flags: IsAdmin, CanManageEnvironments, CanManageUsersAndRoles, CanManageTeams, CanMonitor.";

export const rolesTools: Tool[] = [
  {
    name: "list_roles",
    description:
      "Lists every LifeTime role defined in the infrastructure, with their keys, names " +
      "and permission settings. Use the returned RoleKey with create_user, update_user, " +
      "manage_team_users, or manage_user_app_role.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_role",
    description:
      "Returns the full details of a single LifeTime role, including all permission flags " +
      "and per-environment application/deployment permission levels.",
    inputSchema: {
      type: "object",
      properties: {
        RoleKey: { type: "string", description: "Unique key of the role." },
      },
      required: ["RoleKey"],
    },
  },
  {
    name: "create_role",
    description:
      "Creates a new LifeTime role with a name and a set of permissions. " +
      "Call list_role_permission_levels first to discover valid permission-level keys.",
    inputSchema: {
      type: "object",
      properties: {
        Name: { type: "string", description: "Unique name for the new role." },
        Description: { type: "string", description: "Optional description." },
        Permissions: {
          type: "object",
          description: PERMISSIONS_DESCRIPTION,
        },
      },
      required: ["Name", "Permissions"],
    },
  },
  {
    name: "update_role",
    description:
      "Updates an existing role's name, description and permissions. " +
      "ALL fields are required — fetch with get_role first if you need to preserve any.",
    inputSchema: {
      type: "object",
      properties: {
        RoleKey: { type: "string", description: "Unique key of the role to update." },
        Name: { type: "string", description: "Updated role name." },
        Description: { type: "string", description: "Updated description." },
        Permissions: {
          type: "object",
          description: PERMISSIONS_DESCRIPTION,
        },
      },
      required: ["RoleKey", "Name", "Permissions"],
    },
  },
  {
    name: "delete_role",
    description:
      "Permanently deletes a LifeTime role. Users currently assigned this role will need " +
      "to be reassigned before deletion or the call will fail.",
    inputSchema: {
      type: "object",
      properties: {
        RoleKey: { type: "string", description: "Unique key of the role to delete." },
      },
      required: ["RoleKey"],
    },
  },
  {
    name: "list_role_permission_levels",
    description:
      "Lists all valid permission-level keys that can be used when defining role permissions " +
      "(e.g. None, List, Read, Open, Change&Deploy, FullAccess). " +
      "Call this before create_role or update_role.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

export function rolesHandlers(
  api: AxiosInstance
): Record<string, (args: unknown) => Promise<MCPToolResult>> {
  return {
    list_roles: async (args) => {
      ListRolesSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get("/roles/");
        return data;
      });
    },

    get_role: async (args) => {
      const { RoleKey } = GetRoleSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get(`/roles/${RoleKey}`);
        return data;
      });
    },

    create_role: async (args) => {
      const body = CreateRoleSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.post("/roles/", body);
        return { RoleKey: data };
      });
    },

    update_role: async (args) => {
      const { RoleKey, ...body } = UpdateRoleSchema.parse(args);
      return runTool(async () => {
        await api.put(`/roles/${RoleKey}`, body);
        return `Role ${RoleKey} successfully updated.`;
      });
    },

    delete_role: async (args) => {
      const { RoleKey } = DeleteRoleSchema.parse(args);
      return runTool(async () => {
        await api.delete(`/roles/${RoleKey}`);
        return `Role ${RoleKey} successfully deleted.`;
      });
    },

    list_role_permission_levels: async (args) => {
      ListRolePermissionLevelsSchema.parse(args);
      return runTool(async () => {
        const { data } = await api.get("/roles/permissionlevels");
        return data;
      });
    },
  };
}
