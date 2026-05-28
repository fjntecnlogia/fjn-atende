-- =====================================================================
-- Flag de onboarding tour
-- =====================================================================
-- Quando admin_users.onboarding_completed_at IS NULL, mostra o tour
-- de boas-vindas no painel. Usuário pode marcar como visto.

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Usuários antigos já têm o tour como visto (não vamos forçar replay)
UPDATE admin_users SET onboarding_completed_at = NOW()
  WHERE onboarding_completed_at IS NULL
    AND created_at < NOW() - INTERVAL '1 day';
