-- Adicionar role 'financial' ao constraint de roles de usuários
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'manager', 'employee', 'director', 'financial'));
