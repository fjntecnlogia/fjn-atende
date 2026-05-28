-- =====================================================================
-- Cron de e-mail engajamento — onboarding em 3 toques
-- =====================================================================
-- Dia 1: welcome (já existe, enviado no signup)
-- Dia 3: dicas + casos de uso
-- Dia 7: depoimentos + push pra fechar plano (se ainda não pagou)

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS day3_email_sent_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS day7_email_sent_at    TIMESTAMPTZ;

-- Marca welcome como já enviado pra tenants antigos (não vamos disparar retroativo)
UPDATE tenants SET welcome_email_sent_at = created_at
  WHERE welcome_email_sent_at IS NULL;
