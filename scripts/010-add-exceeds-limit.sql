-- Adicionar campo exceeds_limit à tabela expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS exceeds_limit BOOLEAN DEFAULT FALSE;

-- Adicionar campo limit_exceeded_reason para registrar qual limite foi excedido
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS limit_exceeded_reason TEXT;
