-- Atualizar constraint de roles para incluir novos valores
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('employee', 'manager', 'director', 'admin', 'finance'));
