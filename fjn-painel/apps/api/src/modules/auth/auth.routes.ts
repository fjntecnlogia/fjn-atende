import type { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "../../db/client";
import { requireAuth } from "../../lib/auth";
import { getTenant, getTenantBySlug } from "../../lib/tenant";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signupSchema = z.object({
  company_name: z.string().min(2).max(120),
  slug: z.string().min(3).max(60).regex(/^[a-z0-9-]+$/, "use só letras minúsculas, números e hífen"),
  owner_name: z.string().min(2).max(120),
  owner_email: z.string().email(),
  owner_password: z.string().min(8),
  owner_phone: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------
  // Login
  // -----------------------------------------------------------------
  app.post("/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "dados inválidos" });

    const { email, password } = parsed.data;
    const result = await db.query(
      `SELECT id, email, name, password_hash, role, active, tenant_id
         FROM admin_users WHERE email = $1`,
      [email.toLowerCase()],
    );
    if (result.rowCount === 0) return reply.code(401).send({ error: "credenciais inválidas" });
    const user = result.rows[0];
    if (!user.active) return reply.code(403).send({ error: "usuário desativado" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return reply.code(401).send({ error: "credenciais inválidas" });

    // Não-super_admin: valida tenant ativo
    if (user.role !== "super_admin" && user.tenant_id) {
      const tenant = await getTenant(user.tenant_id);
      if (!tenant) return reply.code(403).send({ error: "tenant não encontrado" });
      if (tenant.status !== "active") {
        return reply.code(403).send({ error: `tenant ${tenant.status}` });
      }
    }

    await db.query(`UPDATE admin_users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

    const token = app.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id ?? null,
    });

    const tenant = user.tenant_id ? await getTenant(user.tenant_id) : null;

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant_id: user.tenant_id,
      },
      tenant,
    };
  });

  // -----------------------------------------------------------------
  // Signup público — cria tenant + usuário owner
  // -----------------------------------------------------------------
  app.post("/signup", async (req, reply) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "dados inválidos", details: parsed.error.format() });
    }
    const data = parsed.data;

    // Slug disponível?
    const existingSlug = await getTenantBySlug(data.slug);
    if (existingSlug) return reply.code(409).send({ error: "slug já em uso" });

    // E-mail disponível?
    const existingUser = await db.query(
      `SELECT id FROM admin_users WHERE email = $1`,
      [data.owner_email.toLowerCase()],
    );
    if (existingUser.rowCount && existingUser.rowCount > 0) {
      return reply.code(409).send({ error: "e-mail já cadastrado" });
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // 1) cria tenant em plano TRIAL (14 dias)
      const tRes = await client.query(
        `INSERT INTO tenants (slug, name, email, phone, plan, status, trial_ends_at, ai_persona, branding)
         VALUES ($1, $2, $3, $4, 'trial', 'active', NOW() + INTERVAL '14 days',
                 '{"name":"Atendente","tone":"caloroso e direto"}'::jsonb,
                 '{"primary_color":"#0B1340","accent_color":"#FFBA00"}'::jsonb)
         RETURNING *`,
        [data.slug.toLowerCase(), data.company_name, data.owner_email.toLowerCase(), data.owner_phone ?? null],
      );
      const tenant = tRes.rows[0];

      // 2) cria usuário owner
      const hash = await bcrypt.hash(data.owner_password, 10);
      const uRes = await client.query(
        `INSERT INTO admin_users (tenant_id, email, name, password_hash, role)
         VALUES ($1, $2, $3, $4, 'owner')
         RETURNING id, email, name, role, tenant_id`,
        [tenant.id, data.owner_email.toLowerCase(), data.owner_name, hash],
      );
      const user = uRes.rows[0];

      await client.query("COMMIT");

      const token = app.jwt.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
        tenant_id: tenant.id,
      });

      return reply.code(201).send({ token, user, tenant });
    } catch (err: any) {
      await client.query("ROLLBACK");
      req.log.error({ err }, "signup falhou");
      return reply.code(500).send({ error: err.message });
    } finally {
      client.release();
    }
  });

  // -----------------------------------------------------------------
  // /me — user atual + tenant atual
  // -----------------------------------------------------------------
  app.get("/me", { preHandler: requireAuth }, async (req) => {
    const result = await db.query(
      `SELECT id, email, name, role, tenant_id FROM admin_users WHERE id = $1`,
      [req.user.sub],
    );
    const user = result.rows[0];
    const tenant = req.tenantId ? await getTenant(req.tenantId) : null;
    return { user, tenant };
  });
}
