-- Adicionar coluna paid para flag de pagamento (adiantamento/reembolso)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT FALSE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_by INTEGER REFERENCES users(id);

-- Adicionar coluna transport_mode para tipo de deslocamento (uber, 99pop, avião, etc.)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(50);

-- Criar índice para consultas de despesas pagas/não pagas
CREATE INDEX IF NOT EXISTS idx_expenses_paid ON expenses(paid);
