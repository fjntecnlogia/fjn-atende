-- =====================================================================
-- WHITE-LABEL — Branding personalizado por tenant
-- =====================================================================
-- A tabela tenants já tem coluna `branding` jsonb desde o início.
-- Apenas garantimos colunas extras pra subdomain + hide_fjn.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS subdomain        VARCHAR(60) UNIQUE,
  ADD COLUMN IF NOT EXISTS hide_fjn_branding BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS support_email    VARCHAR(120),
  ADD COLUMN IF NOT EXISTS support_phone    VARCHAR(40);

-- Branding default pra cada tenant (sobrescreve nulls iniciais)
UPDATE tenants
   SET branding = COALESCE(branding, '{}'::jsonb)
                || jsonb_build_object(
                  'logo_url', COALESCE(branding->>'logo_url', NULL),
                  'primary_color', COALESCE(branding->>'primary_color', '#0B1340'),
                  'accent_color',  COALESCE(branding->>'accent_color', '#FFBA00'),
                  'company_name_override', COALESCE(branding->>'company_name_override', NULL)
                )
 WHERE branding IS NULL OR NOT (branding ? 'primary_color');

CREATE INDEX IF NOT EXISTS idx_tenants_subdomain
  ON tenants(subdomain) WHERE subdomain IS NOT NULL;
