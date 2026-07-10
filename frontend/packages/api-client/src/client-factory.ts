import { createAdminClient } from "./admin-client";
import { createAuthClient } from "./auth-client";
import { createChannelsClient } from "./channels-client";
import { createContactsClient } from "./contacts-client";
import {
  createApiTokensClient,
  createBackupsClient,
  createBotsClient,
  createCronjobsClient,
  createNotificationsClient,
  createPresenceClient,
  createWebhooksClient
} from "./modules-client";
import { createFilesClient } from "./files-client";
import { createHealthClient } from "./health-client";
import { HttpClient, type HttpClientOptions } from "./http-client";
import { createMessagesClient } from "./messages-client";
import { createRbacClient } from "./rbac-client";
import { createUsersClient } from "./users-client";
import { createWorkspacesClient } from "./workspaces-client";

export function createWebTuiApiClient(options: HttpClientOptions) {
  const http = new HttpClient(options);

  return {
    admin: createAdminClient(http),
    apiTokens: createApiTokensClient(http),
    auth: createAuthClient(http),
    backups: createBackupsClient(http),
    bots: createBotsClient(http),
    channels: createChannelsClient(http),
    contacts: createContactsClient(http),
    cronjobs: createCronjobsClient(http),
    files: createFilesClient(http),
    health: createHealthClient(http),
    http,
    messages: createMessagesClient(http),
    notifications: createNotificationsClient(http),
    presence: createPresenceClient(http),
    rbac: createRbacClient(http),
    users: createUsersClient(http),
    webhooks: createWebhooksClient(http),
    workspaces: createWorkspacesClient(http)
  };
}

export type WebTuiApiClient = ReturnType<typeof createWebTuiApiClient>;
