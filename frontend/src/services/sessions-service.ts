import { apiRequest } from "@/api/api-client";
import type { SessionSummary } from "@/types";

export const getMySessions = async (): Promise<SessionSummary[]> => {
  return apiRequest<SessionSummary[]>("/auth/sessions");
};

export const revokeMySession = async (sessionId: string): Promise<void> => {
  await apiRequest<void>(`/auth/sessions/${sessionId}`, { method: "DELETE" });
};

export const revokeAllOtherSessions = async (): Promise<{ revoked_count: number }> => {
  return apiRequest<{ revoked_count: number }>("/auth/sessions/revoke-all", {
    method: "POST",
  });
};
