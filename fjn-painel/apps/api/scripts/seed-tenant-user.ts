/**
 * Cria um usuário dentro de um TENANT específico.
 *
 * Uso: npm run seed:tenant-user -- <tenantId> email@example.com "Nome" senha [role]
 *      role: owner (padrão) | admin | agent
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, shutdownDb } from "../src/db/client";

async function main() {
  const [, , tenantIdStr, email, name, password, roleArg] = process.argv;
  if (!tenantIdStr || !email || !name || !password) {
    console.error('Uso: npm run seed:tenant-user -- <tenantId> email "Nome" senha [role]');
    process.exit(1);
  }
  const tenantId = Number(tenantIdStr);
  const role = (roleArg ?? "owner").toLowerCase();
  if (!["owner", "admin", "agent"].includes(role)) {
    console.error("role inválido. Use: owner | admin | agent");
    process.exit(1);
  }

  // Tenant existe?
  const t = await db.query(`SELECT id, slug, name FROM tenants WHERE id = $1`, [tenantId]);
  if (t.rowCount === 0) {
    console.error(`Tenant #${tenantId} não encontrado.`);
    process.exit(1);
  }
  console.log(`Tenant: #${t.rows[0].id} ${t.rows[0].slug} (${t.rows[0].name})`);

  const hash = await bcrypt.hash(password, 10);
  await db.query(
    `INSERT INTO admin_users (tenant_id, email, name, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email)
     DO UPDATE SET password_hash = EXCLUDED.password_hash,
                   name = EXCLUDED.name,
                   tenant_id = EXCLUDED.tenant_id,
                   role = EXCLUDED.role`,
    [tenantId, email.toLowerCase(), name, hash, role],
  );
  console.log(`✅ Usuário '${email}' criado/atualizado como ${role.toUpperCase()} do tenant #${tenantId}.`);
}

main()
  .catch((err) => {
    console.error("❌", err);
    process.exit(1);
  })
  .finally(() => shutdownDb());
