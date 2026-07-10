import type { Id, ISODateTime, JsonValue } from "./api";

export type ApiScope = {
  id: Id;
  code: string;
  name: string;
  description?: string | null;
  module: string;
  action: string;
};

export type ApiToken = {
  id: Id;
  workspace_id: Id;
  owner_id?: Id | null;
  name: string;
  status: string;
  last_used_at?: ISODateTime | null;
  expires_at?: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  revoked_at?: ISODateTime | null;
  scopes: ApiScope[];
};

export type CreatedApiToken = ApiToken & {
  token: string;
};

export type CreateApiTokenInput = {
  name: string;
  scopes: string[];
  expires_days?: number;
};

export type Bot = {
  id: Id;
  workspace_id: Id;
  slug: string;
  name: string;
  description?: string | null;
  avatar_url?: string | null;
  status: string;
  created_by?: Id | null;
  settings?: JsonValue;
  created_at: ISODateTime;
  updated_at: ISODateTime;
};

export type CreateBotInput = {
  slug: string;
  name: string;
  description?: string;
  avatar_url?: string;
  settings?: JsonValue;
};

export type BotInstallation = {
  id: Id;
  bot_id: Id;
  workspace_id: Id;
  channel_id?: Id | null;
  status: string;
  config?: JsonValue;
  created_at: ISODateTime;
  updated_at: ISODateTime;
};

export type InstallBotInput = {
  channel_id?: Id;
  config?: JsonValue;
};

export type BotMessage = {
  id: Id;
  workspace_id: Id;
  channel_id: Id;
  bot_id: Id;
  kind: string;
  body: string;
  metadata?: JsonValue;
  created_at: ISODateTime;
};

export type SendBotMessageInput = {
  channel_id: Id;
  body: string;
  metadata?: JsonValue;
};

export type IncomingWebhook = {
  id: Id;
  workspace_id: Id;
  channel_id?: Id | null;
  name: string;
  status: string;
  created_by?: Id | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  last_used_at?: ISODateTime | null;
};

export type CreatedIncomingWebhook = IncomingWebhook & {
  secret: string;
  url: string;
};

export type CreateIncomingWebhookInput = {
  channel_id?: Id;
  name: string;
};

export type OutgoingWebhook = {
  id: Id;
  workspace_id: Id;
  name: string;
  target_url: string;
  event_types: string[];
  status: string;
  created_by?: Id | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
};

export type CreatedOutgoingWebhook = OutgoingWebhook & {
  secret: string;
};

export type CreateOutgoingWebhookInput = {
  name: string;
  target_url: string;
  event_types?: string[];
};

export type WebhookDelivery = {
  id: Id;
  outgoing_webhook_id: Id;
  event_id?: Id | null;
  event_type: string;
  request_body?: JsonValue;
  response_status?: number | null;
  response_body?: string | null;
  status: string;
  attempt_count: number;
  next_attempt_at?: ISODateTime | null;
  delivered_at?: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
};
