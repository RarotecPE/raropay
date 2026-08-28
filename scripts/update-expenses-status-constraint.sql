-- Atualizar constraint de status para incluir novos estados
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_status_check;

ALTER TABLE expenses ADD CONSTRAINT expenses_status_check 
CHECK (status IN ('draft', 'processed', 'submitted', 'pending', 'approved', 'rejected', 'correction'));
