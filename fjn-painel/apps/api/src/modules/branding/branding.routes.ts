/**
 * Rotas de Branding (White-label).
 *
 * GET  /branding/by-slug/:slug    → público — frontend usa pra pegar cores/logo
 * GET  /branding/by-subdomain/:s  → público — alternativa por subdomain
 * GET  /branding                  → tenant logado — config atual
 * PUT  /branding                  → owner/admin — atualiza branding
 * POST /branding/upload-logo      → owner/admin — recebe base64 → guarda no JSONB
 *                                   (futuro: upload Vercel Blob/S3)
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../../db/client";
import { requireTenant, requireRole } from "../../lib/auth";

const colorRegex = /^#[0-9A-Fa-f]{6}$/;

const brandingSchema = z.object({
  logo_url:              z.string().url().nullable().optional(),
  primary_color:         z.string().regex(colorRegex).optional(),
  accent_color:          z.string().regex(colorRegex).optional(),
  company_name_override: z.string().max(60).nullable().optional(),
  subdomain:             z.string().min(3).max(60)
                          .regex(/^[a-z0-9-]+$/, "só letras minúsculas, números e hífen")
                          .nullable().optional(),
  hide_fjn_branding:     z.boolean().optional(),
  support_email:         z.string().email().nullable().optional(),
  support_phone:         z.string().max(40).nullable().optional(),
});

// Logo base64 — limita a 100KB pra não estourar o JSONB
const logoUploadSchema = z.object({
  data_url: z.string().regex(/^data:image\/(png|jpeg|svg\+xml|webp);base64,/),
});

export async function brandingRoutes(app: FastifyInstance) {
  // -------------------------------------------------------------------
  // GET /branding/by-slug/:slug — PÚBLICO (login page, e-mails, landing)
  // -------------------------------------------------------------------
  app.get("/by-slug/:slug", async (req, reply) => {
    const slug = (req.params as any).slug;
    const r = await db.query(
      `SELECT name, branding, hide_fjn_branding, support_email, support_phone, subdomain
         FROM tenants WHERE slug = $1 AND status NOT IN ('canceled', 'suspended')`,
      [slug],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "not_found" });
    return r.rows[0];
  });

  // -------------------------------------------------------------------
  // GET /branding/by-subdomain/:subdomain
  // -------------------------------------------------------------------
  app.get("/by-subdomain/:subdomain", async (req, reply) => {
    const sd = (req.params as any).subdomain;
    const r = await db.query(
      `SELECT id, slug, name, branding, hide_fjn_branding, support_email, support_phone
         FROM tenants WHERE subdomain = $1 AND status = 'active'`,
      [sd],
    );
    if (r.rowCount === 0) return reply.code(404).send({ error: "not_found" });
    return r.rows[0];
  });

  // -------------------------------------------------------------------
  // GET /branding — branding do tenant logado (admin view)
  // -------------------------------------------------------------------
  app.get("/", { preHandler: requireTenant }, async (req) => {
    const r = await db.query(
      `SELECT name, slug, branding, hide_fjn_branding, support_email, support_phone, subdomain
         FROM tenants WHERE id = $1`,
      [req.tenantId],
    );
    return r.rows[0];
  });

  // -------------------------------------------------------------------
  // PUT /branding — atualiza (owner ou admin)
  // -------------------------------------------------------------------
  app.put("/", { preHandler: requireRole("owner", "admin", "super_admin") }, async (req, reply) => {
    if (!req.tenantId) {
      return reply.code(400).send({ error: "tenant não selecionado" });
    }
    const data = brandingSchema.parse(req.body);

    // Separa: branding (jsonb) vs colunas dedicadas
    const brandingFields = {
      logo_url:              data.logo_url,
      primary_color:         data.primary_color,
      accent_color:          data.accent_color,
      company_name_override: data.company_name_override,
    };
    // Remove undefined pra não sobrescrever com null
    const brandingPatch: any = {};
    for (const [k, v] of Object.entries(brandingFields)) {
      if (v !== undefined) brandingPatch[k] = v;
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // 1) Merge JSONB branding
      if (Object.keys(brandingPatch).length > 0) {
        await client.query(
          `UPDATE tenants SET branding = COALESCE(branding, '{}'::jsonb) || $1::jsonb
            WHERE id = $2`,
          [JSON.stringify(brandingPatch), req.tenantId],
        );
      }

      // 2) Colunas dedicadas
      const colFields: string[] = [];
      const colValues: any[] = [];
      let i = 1;
      if (data.subdomain !== undefined) {
        colFields.push(`subdomain = $${i++}`);
        colValues.push(data.subdomain);
      }
      if (data.hide_fjn_branding !== undefined) {
        colFields.push(`hide_fjn_branding = $${i++}`);
        colValues.push(data.hide_fjn_branding);
      }
      if (data.support_email !== undefined) {
        colFields.push(`support_email = $${i++}`);
        colValues.push(data.support_email);
      }
      if (data.support_phone !== undefined) {
        colFields.push(`support_phone = $${i++}`);
        colValues.push(data.support_phone);
      }
      if (colFields.length > 0) {
        colValues.push(req.tenantId);
        await client.query(
          `UPDATE tenants SET ${colFields.join(", ")} WHERE id = $${i}`,
          colValues,
        );
      }

      await client.query("COMMIT");
    } catch (err: any) {
      await client.query("ROLLBACK");
      if (err.code === "23505") {
        return reply.code(409).send({ error: "subdomain já em uso" });
      }
      throw err;
    } finally {
      client.release();
    }

    const r = await db.query(
      `SELECT name, slug, branding, hide_fjn_branding, support_email, support_phone, subdomain
         FROM tenants WHERE id = $1`,
      [req.tenantId],
    );
    return r.rows[0];
  });

  // -------------------------------------------------------------------
  // POST /branding/upload-logo — salva base64 inline no JSONB
  // (Limita 100KB. Pra logos maiores, futuramente: upload Vercel Blob)
  // -------------------------------------------------------------------
  app.post("/upload-logo", { preHandler: requireRole("owner", "admin", "super_admin") }, async (req, reply) => {
    if (!req.tenantId) {
      return reply.code(400).send({ error: "tenant não selecionado" });
    }
    const { data_url } = logoUploadSchema.parse(req.body);

    // Calcula tamanho aproximado (base64 = 4/3 do original)
    const sizeBytes = Math.round(data_url.length * 0.75);
    if (sizeBytes > 100 * 1024) {
      return reply.code(413).send({
        error: `logo muito grande (${Math.round(sizeBytes / 1024)}KB). Máximo: 100KB. Comprime a imagem ou envia URL externa.`,
      });
    }

    await db.query(
      `UPDATE tenants SET branding = COALESCE(branding, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
      [JSON.stringify({ logo_url: data_url }), req.tenantId],
    );

    return { ok: true, size_bytes: sizeBytes };
  });
}
