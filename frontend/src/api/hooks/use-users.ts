import { useState, useEffect } from "react";
import { apiFetch } from "@/api/api-client";

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  is_active: boolean;
  org_id: string;
  role_id: string | null;
}

export function useUsers(filters?: { is_active?: boolean }, enabled: boolean = true) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filters?.is_active !== undefined) params.append("is_active", String(filters.is_active));

        const url = `/users${params.toString() ? `?${params.toString()}` : ""}`;
        const data = (await apiFetch(url)) as User[];
        setUsers(data || []);
      } catch (err: unknown) {
        console.error("[useUsers] Error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchUsers();
  }, [filters?.is_active, enabled]);

  return { users, loading, error };
}
