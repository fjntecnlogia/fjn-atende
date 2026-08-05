-- =====================================================================
-- FALLBACK: Criar SUPER_ADMIN via SQL puro
-- =====================================================================
-- Use este script se o `npm run seed` falhar por qualquer motivo
-- (ex: "Cannot find module '../config'" — bug conhecido do tsx no path).
--
-- COMO USAR:
--   1. Gera hash bcrypt da senha (roda no seu terminal):
--        node -e "console.log(require('bcryptjs').hashSync('MinhaSenh@Forte123', 10))"
--   2. Substitui abaixo:
--        SEU_EMAIL       → email desejado
--        SEU_NOME        → nome
--        HASH_BCRYPT_AQUI→ o output do passo 1
--   3. Conecta no banco:
--        docker exec -it atende_pg psql -U postgres -d atende
--   4. Cola este SQL modificado e Enter
-- =====================================================================

INSERT INTO admin_users (tenant_id, email, name, password_hash, role, active, created_at)
VALUES (
  NULL,                       -- super_admin não tem tenant_id
  'SEU_EMAIL',                -- ex: fjntecnologia2022@gmail.com
  'SEU_NOME',                 -- ex: Fagner Jose Neno
  'HASH_BCRYPT_AQUI',         -- output do node -e "..."
  'super_admin',
  TRUE,
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  name          = EXCLUDED.name,
  role          = 'super_admin',
  tenant_id     = NULL,
  active        = TRUE;

-- Confirma:
SELECT id, email, name, role, active, created_at
  FROM admin_users
 WHERE role = 'super_admin';
