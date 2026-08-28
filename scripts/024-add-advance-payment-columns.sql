-- Adicionar colunas para informações de adiantamento e pagamento na tabela expense_batches

-- Valor do adiantamento recebido
ALTER TABLE expense_batches ADD COLUMN IF NOT EXISTS advance_received_amount NUMERIC;

-- Data do adiantamento recebido
ALTER TABLE expense_batches ADD COLUMN IF NOT EXISTS advance_received_date DATE;

-- Se as despesas excederam o adiantamento
ALTER TABLE expense_batches ADD COLUMN IF NOT EXISTS advance_exceeded BOOLEAN;

-- Dados de pagamento (código de barras e PIX)
ALTER TABLE expense_batches ADD COLUMN IF NOT EXISTS payment_data JSONB;
