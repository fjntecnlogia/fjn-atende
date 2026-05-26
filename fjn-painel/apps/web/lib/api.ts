import axios from "axios";

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";

export const api = axios.create({ baseURL });

api.interceptors.request.use((cfg) => {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem("fjn_atende_auth");
    if (raw) {
      try {
        const state = JSON.parse(raw)?.state;
        if (state?.token) cfg.headers.Authorization = `Bearer ${state.token}`;

        // Super-admin: envia tenant selecionado via header
        const role = state?.user?.role;
        if (role === "super_admin" && state.activeTenantId) {
          cfg.headers["X-Tenant-Id"] = String(state.activeTenantId);
        }
      } catch {/* ignora */}
    }

    // Legado
    const legacy = localStorage.getItem("fjn_token");
    if (legacy && !cfg.headers.Authorization) {
      cfg.headers.Authorization = `Bearer ${legacy}`;
    }
  }
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("fjn_atende_auth");
      localStorage.removeItem("fjn_token");
      if (!window.location.pathname.startsWith("/login") &&
          !window.location.pathname.startsWith("/signup")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);
