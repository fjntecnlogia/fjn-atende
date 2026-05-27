import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/client";

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

/**
 * Bloqueia tenants que não pagaram (status != 'active').
 * Super-admins sempre passam (mesmo impersonando).
 * Retorna 402 Payment Required com payload pra frontend redirecionar.
 *
 * Use APÓS requireTenant — quando a rota exige cliente com plano ativo.
 */
export async function requireActiveTenant(req: FastifyRequest, reply: FastifyReply) {
  await requireTenant(req, reply);
  if (reply.sent) return;

  // Super-admin nunca é bloqueado
  if (req.isSuperAdmin) return;

  const r = await db.query(
    `SELECT status FROM tenants WHERE id = $1`,
    [req.tenantId],
  );
  if (r.rowCount === 0) {
    return reply.code(404).send({ error: "tenant não encontrado" });
  }

  const status = r.rows[0].status;
  if (status === "active") return;  // OK, segue o jogo

  return reply.code(402).send({
    error: "subscription_required",
    tenant_status: status,
    message:
      status === "pending_payment"
        ? "Sua conta ainda não tem plano ativo. Escolha um plano pra continuar."
        : status === "past_due"
        ? "Cobrança em atraso. Atualize seu pagamento pra desbloquear."
        : status === "suspended"
        ? "Conta suspensa. Entre em contato com o suporte."
        : `Conta com status '${status}'.`,
    cta_url: "/planos",
  });
}
