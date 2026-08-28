-- Adicionar coluna phone na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
