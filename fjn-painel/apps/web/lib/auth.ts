"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdminUser, Tenant } from "@fjn-painel/shared";

export type { AdminUser, Tenant };

interface AuthState {
  token: string | null;
  user: AdminUser | null;
  tenant: Tenant | null;
  activeTenantId: number | null;

  setSession: (token: string, user: AdminUser, tenant: Tenant | null) => void;
  setActiveTenant: (tenant: Tenant | null) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      tenant: null,
      activeTenantId: null,
      setSession: (token, user, tenant) =>
        set({ token, user, tenant, activeTenantId: tenant?.id ?? null }),
      setActiveTenant: (tenant) =>
        set({ activeTenantId: tenant?.id ?? null, tenant: tenant ?? get().tenant }),
      logout: () => set({ token: null, user: null, tenant: null, activeTenantId: null }),
    }),
    { name: "fjn_atende_auth" },
  ),
);

export function isSuperAdmin(): boolean {
  return useAuth.getState().user?.role === "super_admin";
}
