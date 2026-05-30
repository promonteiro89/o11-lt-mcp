/**
 * Zod schemas derived from the LifeTime REST API v2 Swagger definitions.
 * Used for rigorous input validation of every MCP tool argument.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitives / shared
// ---------------------------------------------------------------------------

export const KeySchema = z.string().min(1);

// ---------------------------------------------------------------------------
// User schemas
// ---------------------------------------------------------------------------

export const CreateUserSchema = z.object({
  Username: z.string().min(1).describe("Login username (must be unique)."),
  Name: z.string().min(1).describe("Display name of the user."),
  Email: z.string().email().describe("Email address of the user."),
  IsActive: z
    .boolean()
    .default(true)
    .describe("Whether the user account is active."),
  RoleKey: z
    .string()
    .min(1)
    .describe("Key of the LifeTime role to assign to the user."),
});

export const UpdateUserSchema = z.object({
  UserKey: KeySchema.describe("Unique key of the user to update."),
  Username: z.string().min(1).describe("Login username."),
  Name: z.string().min(1).describe("Display name of the user."),
  Email: z.string().email().describe("Email address of the user."),
  IsActive: z.boolean().describe("Whether the user account is active."),
  RoleKey: z.string().min(1).describe("Key of the LifeTime role."),
});

export const ListUsersSchema = z.object({
  IncludeInactive: z
    .boolean()
    .optional()
    .describe("Set true to include inactive users in the response."),
  IncludeTeams: z
    .boolean()
    .optional()
    .describe("Set true to include the teams each user belongs to."),
  IncludeApplicationRoles: z
    .boolean()
    .optional()
    .describe("Set true to include application-level roles for each user."),
});

// ---------------------------------------------------------------------------
// Team schemas
// ---------------------------------------------------------------------------

export const DeleteTeamSchema = z.object({
  TeamKey: KeySchema.describe("Unique key of the team to delete."),
});

export const CreateTeamSchema = z.object({
  name: z.string().min(1).describe("Name of the new team (must be unique)."),
  description: z.string().default("").describe("Optional description of the team."),
});

export const ListTeamsSchema = z.object({
  IncludeUsers: z
    .boolean()
    .optional()
    .describe("Set true to include the list of users that belong to each team."),
  IncludeApplications: z
    .boolean()
    .optional()
    .describe("Set true to include the list of applications in each team."),
});

export const ManageTeamUsersSchema = z.object({
  TeamKey: KeySchema.describe("Unique key of the target team."),
  action: z
    .enum(["add", "remove"])
    .describe('"add" to add the user with a role; "remove" to remove them.'),
  UserKey: KeySchema.describe("Unique key of the user."),
  RoleKey: z
    .string()
    .optional()
    .describe(
      'Required when action is "add". Key of the role to grant to the user in the team.'
    ),
});

export const ManageTeamAppsSchema = z.object({
  TeamKey: KeySchema.describe("Unique key of the target team."),
  action: z
    .enum(["add", "remove"])
    .describe('"add" to add the application; "remove" to remove it.'),
  ApplicationKey: KeySchema.describe("Unique key of the application."),
});

// ---------------------------------------------------------------------------
// Environment schemas
// ---------------------------------------------------------------------------

export const GetEnvironmentsSchema = z.object({});

// ---------------------------------------------------------------------------
// Application schemas
// ---------------------------------------------------------------------------

export const GetEnvironmentTemplatesSchema = z.object({
  EnvironmentKey: KeySchema.describe(
    "Key of the environment whose template list is requested. Use get_environments to find it."
  ),
});

export const CreateApplicationSchema = z.object({
  EnvironmentKey: KeySchema.describe(
    "Key of the environment where the application will be created (typically Development)."
  ),
  Name: z.string().min(1).describe("Unique name for the new application."),
  TemplateKey: KeySchema.describe(
    "Template key used to bootstrap the app. Use get_environment_templates to list available templates (e.g. Reactive Web App, Mobile App)."
  ),
  TeamKey: KeySchema.describe(
    "Key of the team that will own this application. Use list_teams or create_team to obtain it."
  ),
  Color: z
    .string()
    .default("#FF0000")
    .describe("Primary theme colour in hexadecimal format, e.g. #3A7BD5."),
  Description: z
    .string()
    .default("")
    .describe("Optional short description of the application."),
});

export const GetApplicationsSchema = z.object({
  IncludeModules: z
    .boolean()
    .optional()
    .describe("Set true to include module details for each application."),
  IncludeEnvStatus: z
    .boolean()
    .optional()
    .describe("Set true to include per-environment status for each application."),
});

// ---------------------------------------------------------------------------
// Deployment schemas
// ---------------------------------------------------------------------------

export const ListDeploymentsSchema = z.object({
  MinDate: z
    .string()
    .optional()
    .describe(
      "Minimum creation date filter (YYYY-MM-DD). Defaults to 1 week ago."
    ),
  MaxDate: z
    .string()
    .optional()
    .describe(
      "Maximum creation date filter (YYYY-MM-DD). Defaults to today."
    ),
  TargetEnvironmentKey: z
    .string()
    .optional()
    .describe(
      "Filter deployments by target environment key. Leave empty for all environments."
    ),
});

/** Each item in ApplicationOperations when creating a deployment */
export const ApplicationOperationSchema = z.object({
  ApplicationVersionKey: KeySchema.describe(
    "The specific application version key to deploy. Use get_applications (IncludeEnvStatus=true) to discover version keys."
  ),
  DeploymentZoneKey: z
    .string()
    .default("")
    .describe(
      "Deployment zone key. Pass an empty string to use the environment default zone."
    ),
});

export const CreateDeploymentSchema = z.object({
  SourceEnvironmentKey: KeySchema.describe(
    "Key of the environment to deploy FROM (e.g. Development). Get keys via get_environments."
  ),
  TargetEnvironmentKey: KeySchema.describe(
    "Key of the environment to deploy TO (e.g. Quality or Production)."
  ),
  Notes: z
    .string()
    .default("")
    .describe("Optional deployment notes / release comment."),
  ApplicationOperations: z
    .array(ApplicationOperationSchema)
    .min(1)
    .describe(
      "List of application versions to include in this deployment plan."
    ),
});

export const ExecuteDeploymentCommandSchema = z.object({
  DeploymentKey: KeySchema.describe(
    "Key of the deployment plan to operate on."
  ),
  Command: z
    .enum(["start", "continue", "abort"])
    .describe(
      '"start" initiates the deployment; "continue" resumes after user-intervention; "abort" cancels it.'
    ),
  RedeployOutdated: z
    .boolean()
    .optional()
    .describe(
      "If true, outdated applications in the target environment will also be redeployed."
    ),
  IncludeErrorDetails: z
    .boolean()
    .optional()
    .describe(
      "If true, error messages will contain extended detail when a problem occurs."
    ),
});

export const GetDeploymentStatusSchema = z.object({
  DeploymentKey: KeySchema.describe(
    "Key of the deployment whose execution status is requested."
  ),
});

export const GetDeploymentSchema = z.object({
  DeploymentKey: KeySchema.describe("Key of the deployment plan to retrieve."),
});

export const UpdateDeploymentSchema = z.object({
  DeploymentKey: KeySchema.describe("Key of the deployment plan to update."),
  Notes: z.string().default("").describe("Updated deployment notes."),
  ApplicationOperations: z
    .array(ApplicationOperationSchema)
    .min(1)
    .describe("Updated list of application versions to include."),
});

export const DeleteDeploymentSchema = z.object({
  DeploymentKey: KeySchema.describe("Key of the deployment plan to delete."),
});

// ---------------------------------------------------------------------------
// Role schemas
// ---------------------------------------------------------------------------

export const ListRolesSchema = z.object({});

export const GetRoleSchema = z.object({
  RoleKey: KeySchema.describe("Unique key of the role to fetch."),
});

/**
 * Permission level keys are strings such as "None", "List", "Read", "Open",
 * "Change&Deploy", etc. Use list_role_permission_levels to discover them.
 */
export const RolePermissionsSchema = z
  .object({
    EnvironmentPermissionsSet: z
      .array(
        z.object({
          EnvironmentKey: KeySchema,
          ApplicationPermissionLevelKey: z.string().min(1),
          DeploymentPermissionLevelKey: z.string().min(1),
        })
      )
      .optional()
      .describe("Per-environment permissions for applications and deployments."),
    HasGlobalApplicationPermissions: z.boolean().optional(),
    GlobalApplicationPermissionLevelKey: z.string().optional(),
    IsAdmin: z.boolean().optional(),
    CanManageEnvironments: z.boolean().optional(),
    CanManageUsersAndRoles: z.boolean().optional(),
    CanManageTeams: z.boolean().optional(),
    CanMonitor: z.boolean().optional(),
  })
  .passthrough();

export const CreateRoleSchema = z.object({
  Name: z.string().min(1).describe("Unique name for the new role."),
  Description: z.string().default("").describe("Optional description."),
  Permissions: RolePermissionsSchema.describe(
    "Permission flags and per-environment permission levels."
  ),
});

export const UpdateRoleSchema = z.object({
  RoleKey: KeySchema.describe("Unique key of the role to update."),
  Name: z.string().min(1).describe("Role name."),
  Description: z.string().default("").describe("Role description."),
  Permissions: RolePermissionsSchema.describe("Updated permission set."),
});

export const DeleteRoleSchema = z.object({
  RoleKey: KeySchema.describe("Unique key of the role to delete."),
});

export const ListRolePermissionLevelsSchema = z.object({});

// ---------------------------------------------------------------------------
// Module schemas
// ---------------------------------------------------------------------------

export const ListModulesSchema = z.object({});

export const GetModuleSchema = z.object({
  ModuleKey: KeySchema.describe("Unique key of the module."),
});

export const ListModuleVersionsSchema = z.object({
  ModuleKey: KeySchema.describe("Unique key of the module."),
});

export const GetModuleVersionSchema = z.object({
  ModuleKey: KeySchema.describe("Unique key of the module."),
  ModuleVersionKey: KeySchema.describe("Unique key of the module version."),
});

// ---------------------------------------------------------------------------
// User extra schemas
// ---------------------------------------------------------------------------

export const GetUserSchema = z.object({
  UserKey: KeySchema.describe("Unique key of the user to fetch."),
});

export const ManageUserAppRoleSchema = z.object({
  UserKey: KeySchema.describe("Unique key of the user."),
  action: z
    .enum(["set", "remove"])
    .describe(
      '"set" assigns or updates the user\'s role for an application; "remove" revokes it.'
    ),
  ApplicationKey: KeySchema.describe("Unique key of the application."),
  RoleKey: z
    .string()
    .optional()
    .describe('Role key to assign. Required when action is "set".'),
});

export const GetUserBlockedLoginsSchema = z.object({
  UserKey: KeySchema.describe("Unique key of the user."),
});

export const UnblockUserLoginsSchema = z.object({
  UserKey: KeySchema.describe("Unique key of the user to unblock."),
});

// ---------------------------------------------------------------------------
// Team extra schemas
// ---------------------------------------------------------------------------

export const GetTeamSchema = z.object({
  TeamKey: KeySchema.describe("Unique key of the team to fetch."),
});

export const UpdateTeamSchema = z.object({
  TeamKey: KeySchema.describe("Unique key of the team to update."),
  name: z.string().min(1).describe("Updated team name."),
  description: z.string().default("").describe("Updated team description."),
});

// ---------------------------------------------------------------------------
// Application extra schemas
// ---------------------------------------------------------------------------

export const GetApplicationSchema = z.object({
  ApplicationKey: KeySchema.describe("Unique key of the application."),
});

export const ListApplicationVersionsSchema = z.object({
  ApplicationKey: KeySchema.describe("Unique key of the application."),
});

export const GetApplicationVersionSchema = z.object({
  ApplicationKey: KeySchema.describe("Unique key of the application."),
  VersionKey: KeySchema.describe("Unique key of the application version."),
});

export const DeleteApplicationVersionSchema = z.object({
  ApplicationKey: KeySchema.describe("Unique key of the application."),
  VersionKey: KeySchema.describe(
    "Unique key of the application version to discard."
  ),
});

// ---------------------------------------------------------------------------
// Environment extra schemas
// ---------------------------------------------------------------------------

export const CreateEnvironmentSchema = z.object({
  Name: z.string().min(1).describe("Name of the new environment."),
  HostName: z
    .string()
    .min(1)
    .describe("Hostname or IP of the environment's platform server."),
  Type: z
    .string()
    .default("Development")
    .describe(
      'Environment type (e.g. "Development", "Quality", "Production").'
    ),
});

export const GetEnvironmentSchema = z.object({
  EnvironmentKey: KeySchema.describe(
    "Unique key of the environment to fetch."
  ),
});

export const DeleteEnvironmentSchema = z.object({
  EnvironmentKey: KeySchema.describe(
    "Unique key of the environment to unregister."
  ),
});

export const ListEnvironmentAppsSchema = z.object({
  EnvironmentKey: KeySchema.describe("Unique key of the environment."),
});

export const GetEnvironmentAppSchema = z.object({
  EnvironmentKey: KeySchema.describe("Unique key of the environment."),
  ApplicationKey: KeySchema.describe("Unique key of the application."),
});

export const ListDeploymentZonesSchema = z.object({
  EnvironmentKey: KeySchema.describe("Unique key of the environment."),
});

export const SetMaintenanceModeSchema = z.object({
  EnvironmentKey: KeySchema.describe("Unique key of the environment."),
  Enabled: z
    .boolean()
    .describe("True to enable maintenance mode; false to disable it."),
});

export const ListBlockedIpsSchema = z.object({});

export const UnblockIpSchema = z.object({
  IpAddress: z
    .string()
    .min(1)
    .describe("IP address to unblock from login attempts."),
});

// ---------------------------------------------------------------------------
// Database connection schemas
// ---------------------------------------------------------------------------

export const ListDbProvidersSchema = z.object({
  EnvironmentKey: KeySchema.describe(
    "Unique key of the environment to query for available DB providers."
  ),
});

export const ListDbConnectionsSchema = z.object({
  EnvironmentKey: KeySchema.describe("Unique key of the environment."),
});

/**
 * The exact fields accepted depend on the database provider. Common ones:
 * Name, DatabaseProvider, Server, Database, Schema, Username, Password,
 * Port, AdditionalConnectionString. Use list_db_connection_providers to
 * discover provider-specific requirements.
 */
const DbConnectionPayloadShape = z
  .object({
    Name: z.string().min(1).describe("Unique name for the connection."),
    DatabaseProvider: z
      .string()
      .min(1)
      .describe(
        "Provider key (e.g. SqlServer, Oracle, MySQL). Use list_db_connection_providers to discover valid values."
      ),
    Server: z.string().optional().describe("Database server hostname / address."),
    Database: z.string().optional().describe("Database / catalog name."),
    Schema: z.string().optional().describe("Schema name."),
    Username: z.string().optional().describe("Login username."),
    Password: z.string().optional().describe("Login password."),
    Port: z.number().int().optional().describe("Database port."),
    AdditionalConnectionString: z
      .string()
      .optional()
      .describe("Optional extra connection-string parameters."),
  })
  .passthrough();

export const CreateDbConnectionSchema = z.object({
  EnvironmentKey: KeySchema.describe(
    "Unique key of the environment where the connection will be created."
  ),
  Payload: DbConnectionPayloadShape.describe(
    "Connection configuration. Required fields depend on the provider."
  ),
});

export const GetDbConnectionSchema = z.object({
  EnvironmentKey: KeySchema.describe("Unique key of the environment."),
  DbConnectionName: z
    .string()
    .min(1)
    .describe("Name of the database connection."),
});

export const UpdateDbConnectionSchema = z.object({
  EnvironmentKey: KeySchema.describe("Unique key of the environment."),
  DbConnectionName: z
    .string()
    .min(1)
    .describe("Name of the database connection to update."),
  Payload: DbConnectionPayloadShape.describe(
    "Updated connection configuration."
  ),
});

export const DeleteDbConnectionSchema = z.object({
  EnvironmentKey: KeySchema.describe("Unique key of the environment."),
  DbConnectionName: z
    .string()
    .min(1)
    .describe("Name of the database connection to delete."),
});

export const TestDbConnectionSchema = z.object({
  EnvironmentKey: KeySchema.describe("Unique key of the environment."),
  Payload: DbConnectionPayloadShape.describe(
    "Connection configuration to test (without persisting it)."
  ),
});

export const ManageDbConnectionRolePermissionSchema = z.object({
  EnvironmentKey: KeySchema.describe("Unique key of the environment."),
  DbConnectionName: z
    .string()
    .min(1)
    .describe("Name of the database connection."),
  action: z
    .enum(["set", "remove"])
    .describe(
      '"set" assigns or updates the permission level; "remove" revokes it.'
    ),
  RoleKey: KeySchema.describe("Unique key of the role."),
  PermissionLevelKey: z
    .string()
    .optional()
    .describe(
      'Permission level (e.g. "None", "Read", "ReadWrite"). Required when action is "set". ' +
        "Use list_db_connection_permission_levels to discover valid values."
    ),
});

export const GetDbConnectionRolePermissionSchema = z.object({
  EnvironmentKey: KeySchema.describe("Unique key of the environment."),
  DbConnectionName: z
    .string()
    .min(1)
    .describe("Name of the database connection."),
  RoleKey: KeySchema.describe("Unique key of the role."),
});

export const ManageDbConnectionUserPermissionSchema = z.object({
  EnvironmentKey: KeySchema.describe("Unique key of the environment."),
  DbConnectionName: z
    .string()
    .min(1)
    .describe("Name of the database connection."),
  action: z
    .enum(["set", "remove"])
    .describe(
      '"set" assigns or updates the permission level; "remove" revokes it.'
    ),
  Username: z.string().min(1).describe("Username of the user."),
  PermissionLevelKey: z
    .string()
    .optional()
    .describe(
      'Permission level. Required when action is "set". ' +
        "Use list_db_connection_permission_levels to discover valid values."
    ),
});

export const GetDbConnectionUserPermissionSchema = z.object({
  EnvironmentKey: KeySchema.describe("Unique key of the environment."),
  DbConnectionName: z
    .string()
    .min(1)
    .describe("Name of the database connection."),
  Username: z.string().min(1).describe("Username of the user."),
});

// ---------------------------------------------------------------------------
// Application Configurations & Versioning
// ---------------------------------------------------------------------------

export const GetApplicationConfigurationsSchema = z.object({
  ApplicationKey: KeySchema.describe("Unique key of the application."),
});

export const ApplicationConfigurationItemSchema = z.object({
  Key: z
    .string()
    .min(1)
    .describe(
      "Configuration item key (e.g. a site property or timer key). " +
        "Obtain it from get_application_configurations."
    ),
  Value: z.string().describe("New value to set for this configuration item."),
});

export const UpdateApplicationConfigurationsSchema = z.object({
  ApplicationKey: KeySchema.describe("Unique key of the application."),
  EnvironmentKey: KeySchema.describe(
    "Key of the environment whose configurations should be updated."
  ),
  Configurations: z
    .array(ApplicationConfigurationItemSchema)
    .min(1)
    .describe("Configuration items to update in the target environment."),
});

export const MobileVersionSchema = z.object({
  NativePlatform: z
    .enum(["Android", "iOS"])
    .describe("Mobile platform."),
  NativeBuild: z
    .number()
    .int()
    .describe("Native build number for that platform."),
});

export const TagRunningVersionSchema = z.object({
  EnvironmentKey: KeySchema.describe(
    "Key of the environment where the application is currently running."
  ),
  ApplicationKey: KeySchema.describe(
    "Unique key of the application whose running state should be tagged."
  ),
  Version: z
    .string()
    .min(1)
    .describe('Version label to assign (e.g. "1.5.2").'),
  ChangeLog: z
    .string()
    .optional()
    .describe("Optional changelog or release notes for this version."),
  MobileVersions: z
    .array(MobileVersionSchema)
    .optional()
    .describe(
      "Optional mobile build versions (Android/iOS) when the app is a mobile app."
    ),
});

// ---------------------------------------------------------------------------
// Composite operations
// ---------------------------------------------------------------------------

export const CleanupOldDeploymentPlansSchema = z.object({
  OlderThanDays: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .default(30)
    .describe("Discard saved plans older than N days (default 30)."),
  DryRun: z
    .boolean()
    .default(true)
    .describe(
      "If true (default), only report which plans would be deleted without deleting them."
    ),
  TargetEnvironmentKey: z
    .string()
    .optional()
    .describe("Optional: limit to plans targeting this environment."),
});

export const GetApplicationDependenciesSchema = z.object({
  ApplicationKey: KeySchema.describe(
    "Unique key of the application whose dependencies should be listed."
  ),
});

export const GetApplicationConsumersSchema = z.object({
  ApplicationKey: KeySchema.describe(
    "Unique key of the application whose consumers should be listed."
  ),
});

export const ListDbConnectionPermissionLevelsSchema = z.object({});
