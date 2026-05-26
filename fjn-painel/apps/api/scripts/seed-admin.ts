/**
 * Cria usuário SUPER_ADMIN (você — para gerenciar o SaaS inteiro).
 *
 * Uso: npm run seed -- email@fjn.com.br "Nome" senhaForte
 *
 * Esse script:
 *   1. Aplica TODAS as migrations (schema-admin + multitenant)
 *   2. Cria/atualiza um SUPER_ADMIN (role super_admin, tenant_id = NULL)
 *
 * Para criar um usuário OWNER do tenant FJN também, rode separadamente:
 *   npm run seed:tenant-user -- 1 fjn-owner@... "Nome" senha
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, shutdownDb } from "../src/db/client";
import * as fs from "fs";
import * as path from "path";

async function applyMigration(file: string) {
  const p = path.join(__dirname, "..", "src", "db", file);
  if (!fs.existsSync(p)) {
    // pode estar em migrations/
    const alt = path.join(__dirname, "..", "src", "db", "migrations", file);
    if (fs.existsSync(alt)) {
      await db.query(fs.readFileSync(alt, "utf-8"));
      console.log(`✅ Migration aplicada: migrations/${file}`);
      return;
    }
    console.warn(`(skip) Não achei ${file}`);
    return;
  }
  await db.query(fs.readFileSync(p, "utf-8"));
  console.log(`✅ Migration aplicada: ${file}`);
}

async function main() {
  const [, , email, name, password] = process.argv;
  if (!email || !name || !password) {
    console.error("Uso: npm run seed -- email@fjn.com.br \"Nome\" senhaForte");
    process.exit(1);
  }

  // Aplica migrations em ordem
  await applyMigration("schema-admin.sql");
  await applyMigration("03_multitenant.sql");

  const hash = await bcrypt.hash(password, 10);
  await db.query(
    `INSERT INTO admin_users (tenant_id, email, name, password_hash, role)
     VALUES (NULL, $1, $2, $3, 'super_admin')
     ON CONFLICT (email)
     DO UPDATE SET password_hash = EXCLUDED.password_hash,
                   name = EXCLUDED.name,
                   role = 'super_admin',
                   tenant_id = NULL`,
    [email.toLowerCase(), name, hash],
  );
  console.log(`✅ SUPER-ADMIN '${email}' criado/atualizado.`);
  console.log("");
  console.log("Esse usuário pode:");
  console.log("  - Ver e gerenciar TODOS os tenants do SaaS");
  console.log("  - Acessar /tenants/* (endpoints exclusivos)");
  console.log("  - Logar em qualquer tenant via header X-Tenant-Id");
  console.log("");
  console.log("Para usar o tenant FJN (tenant #1) como atendente normal, crie outro");
  console.log("usuário owner com:");
  console.log(`  npm run seed:tenant-user -- 1 owner@fjn.com.br "Seu Nome" suaSenha`);
}

main()
  .catch((err) => {
    console.error("❌", err);
    process.exit(1);
  })
  .finally(() => shutdownDb());
