-- Adicionar colunas de revisão na tabela expense_batches
ALTER TABLE expense_batches ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE expense_batches ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id);
ALTER TABLE expense_batches ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;
