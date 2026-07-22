import type { HttpClient } from "./http-client";
import { itemFrom } from "./response-utils";

export type ZegoCallCredentials = {
  app_id: number;
  app_sign: string;
  user_id: string;
  user_name?: string;
  token: string;
  expires_at?: string;
};

export function createVideoClient(http: HttpClient) {
  return {
    async zegoToken(): Promise<ZegoCallCredentials> {
      const data = await http.get<unknown>("/api/v1/video/zego-token");
      const credentials = itemFrom<ZegoCallCredentials>(data, "zego_call");
      if (!credentials?.app_id || !credentials.app_sign || !credentials.user_id || !credentials.token) {
        throw new Error("ZEGOCLOUD chưa được cấu hình đúng.");
      }
      return credentials;
    }
  };
}
