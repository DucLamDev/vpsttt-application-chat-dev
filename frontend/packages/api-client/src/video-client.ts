import type { HttpClient } from "./http-client";
import { itemFrom } from "./response-utils";

export type StreamVideoCredentials = {
  api_key: string;
  user_id: string;
  token: string;
  expires_at?: string;
};

export function createVideoClient(http: HttpClient) {
  return {
    async streamToken(): Promise<StreamVideoCredentials> {
      const data = await http.get<unknown>("/api/v1/video/stream-token");
      const credentials = itemFrom<StreamVideoCredentials>(data, "stream_video");
      if (!credentials?.api_key || !credentials.user_id || !credentials.token) {
        throw new Error("Stream Video chưa được cấu hình đúng.");
      }
      return credentials;
    }
  };
}
