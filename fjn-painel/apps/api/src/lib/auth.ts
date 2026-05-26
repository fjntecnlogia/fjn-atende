import type { FastifyReply, FastifyRequest } from "fastify";

export type AdminRole = "super_admin" | "owner" | "admin" | "agent";

export interface JwtPayload {
  sub: number;
  email: string;
  role: AdminRole;
  tenant_id: number | null;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    tenantId?: number | null;
    isSuperAdmin?: boolean;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "não autenticado" });
  }

  req.isSuperAdmin = req.user.role === "super_admin";

  if (req.isSuperAdmin) {
    // Super-admin pode escolher tenant via header (opcional)
    const header = req.headers["x-tenant-id"];
    const headerValue = Array.isArray(header) ? header[0] : header;
    req.tenantId = headerValue ? Number(headerValue) : null;
  } else {
    req.tenantId = req.user.tenant_id ?? null;
    if (!req.tenantId) {
      return reply.code(403).send({ error: "usuário sem tenant associado" });
    }
  }
}

/**
 * Garante request autenticado E com tenant_id concreto.
 */
export async function requireTenant(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if (!req.tenantId) {
    return reply.code(400).send({
      error: "tenant não selecionado. Super-admin deve enviar header X-Tenant-Id",
    });
  }
}

export function requireRole(...roles: AdminRole[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(req, reply);
    if (reply.sent) return;
    if (!roles.includes(req.user.role)) {
      return reply.code(403).send({ error: "sem permissão" });
    }
  };
}

export async function requireSuperAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireAuth(req, reply);
  if (reply.sent) return;
  if (req.user.role !== "super_admin") {
    return reply.code(403).send({ error: "apenas super-admin" });
  }
}
