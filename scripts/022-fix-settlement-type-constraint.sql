-- Remove a constraint antiga de settlement_type e adiciona uma nova com mais valores
ALTER TABLE expense_batches DROP CONSTRAINT IF EXISTS expense_batches_settlement_type_check;

-- Adiciona nova constraint que aceita os valores corretos incluindo corporate_card
ALTER TABLE expense_batches ADD CONSTRAINT expense_batches_settlement_type_check 
CHECK (settlement_type IN ('corporate_card', 'cartao_corporativo', 'advance', 'adiantamento', 'reembolso', 'refund', 'misto', 'mixed'));
