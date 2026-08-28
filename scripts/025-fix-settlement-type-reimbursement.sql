-- Atualiza constraint de settlement_type para incluir 'reimbursement'
ALTER TABLE expense_batches DROP CONSTRAINT IF EXISTS expense_batches_settlement_type_check;

ALTER TABLE expense_batches ADD CONSTRAINT expense_batches_settlement_type_check
CHECK (settlement_type IN ('corporate_card', 'cartao_corporativo', 'advance', 'adiantamento', 'reembolso', 'refund', 'reimbursement', 'misto', 'mixed'));
