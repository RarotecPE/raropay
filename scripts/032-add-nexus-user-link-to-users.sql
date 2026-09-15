-- Vinculo entre usuarios locais do RaroPay e usuarios do RaroNexus.
-- Mantem dados financeiros locais no mesmo users.id, mas torna o RaroNexus
-- a fonte de identidade, perfil e status ativo.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS nexus_user_id uuid,
  ADD COLUMN IF NOT EXISTS nexus_email varchar(255);

CREATE UNIQUE INDEX IF NOT EXISTS users_nexus_user_id_unique
  ON users (nexus_user_id)
  WHERE nexus_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_nexus_email
  ON users (LOWER(nexus_email))
  WHERE nexus_email IS NOT NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

UPDATE users
SET role = 'financial'
WHERE role = 'finance';

ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('employee', 'manager', 'director', 'admin', 'financial', 'coordinator'));
