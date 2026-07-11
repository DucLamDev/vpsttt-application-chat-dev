import type { Id, ISODateTime } from "./api";

export type AuthUser = {
  id: Id;
  email: string;
  username: string;
  display_name?: string;
  avatar_url?: string | null;
  phone_number?: string | null;
  status?: string;
  created_at?: ISODateTime;
  updated_at?: ISODateTime;
};

export type AuthTokenSet = {
  access_token: string;
  access_token_expires_at?: string;
  refresh_token?: string;
  refresh_token_expires_at?: string;
  token_type?: string;
  expires_in?: number;
};

export type AuthResult = {
  access_token?: string;
  access_token_expires_at?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_at?: string;
  refresh_until?: string;
  session_id?: string;
  token_type?: string;
  tokens?: AuthTokenSet;
  user?: AuthUser;
};

export type LoginInput = {
  identifier: string;
  password: string;
  device_name?: string;
};

export type GoogleLoginInput = {
  credential: string;
  device_name?: string;
};

export type RegisterInput = {
  email: string;
  username: string;
  display_name: string;
  password: string;
  device_name?: string;
};

export type RefreshInput = {
  refresh_token: string;
};

export type LogoutInput = {
  refresh_token: string;
};

export type AuthSession = {
  id: Id;
  device_name?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  last_seen_at?: ISODateTime | null;
  expires_at?: ISODateTime;
  revoked_at?: ISODateTime | null;
  created_at?: ISODateTime;
};
