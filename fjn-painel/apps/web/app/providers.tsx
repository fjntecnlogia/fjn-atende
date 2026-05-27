"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, createContext, useContext } from "react";
import { Toaster } from "react-hot-toast";
import type { ResolvedTenantBranding } from "@/lib/resolve-tenant";

// Contexto que carrega o branding do tenant (vindo do SSR)
const TenantBrandingContext = createContext<ResolvedTenantBranding | null>(null);

export function useTenantBranding() {
  return useContext(TenantBrandingContext);
}

export function Providers({
  children,
  initialTenantBranding,
}: {
  children: React.ReactNode;
  initialTenantBranding?: ResolvedTenantBranding | null;
}) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <TenantBrandingContext.Provider value={initialTenantBranding ?? null}>
      <QueryClientProvider client={qc}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#0F1A52",
              color: "#F4F6FF",
              border: "1px solid #1A2358",
            },
          }}
        />
      </QueryClientProvider>
    </TenantBrandingContext.Provider>
  );
}
