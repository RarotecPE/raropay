-- Adicionar coluna original_batch_id para rastrear a remessa original
-- Útil quando despesa é corrigida e precisa voltar para a remessa original

ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS original_batch_id INTEGER REFERENCES expense_batches(id);

-- Criar índice para buscas por original_batch_id
CREATE INDEX IF NOT EXISTS idx_expenses_original_batch_id ON expenses(original_batch_id);

-- Atualizar despesas existentes que estão em correção/rejeitadas para ter o original_batch_id
-- (para despesas que já foram processadas antes desta migração)
UPDATE expenses 
SET original_batch_id = batch_id 
WHERE batch_id IS NOT NULL AND original_batch_id IS NULL;
