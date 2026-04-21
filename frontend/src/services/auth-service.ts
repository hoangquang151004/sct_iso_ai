import { apiRequest, clearAccessToken, setAccessToken } from "@/lib/api-client";
import type { AuthPrincipal, AuthTokenResponse } from "@/types";

type LoginPayload = {
  username: string;
  password: string;
  device_label?: string;
};

export async function login(
  usernameOrPayload: string | LoginPayload,
  password?: string,
): Promise<AuthTokenResponse> {
  const payload: LoginPayload =
    typeof usernameOrPayload === "string"
      ? { username: usernameOrPayload, password: password || "" }
      : usernameOrPayload;
  const result = await apiRequest<AuthTokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setAccessToken(result.access_token);
  return result;
}

export async function refreshSession(): Promise<AuthTokenResponse> {
  const result = await apiRequest<AuthTokenResponse>("/auth/refresh", {
    method: "POST",
  });
  setAccessToken(result.access_token);
  return result;
}

export async function getCurrentPrincipal(): Promise<AuthPrincipal> {
  return apiRequest<AuthPrincipal>("/auth/me");
}

export async function logout(): Promise<void> {
  await apiRequest<void>("/auth/logout", { method: "POST" });
  clearAccessToken();
}
