-- Adicionar colunas para controle de desaprovação de despesas
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS unapproved_at TIMESTAMP;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS unapproved_by INTEGER REFERENCES users(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS unapproval_reason TEXT;
