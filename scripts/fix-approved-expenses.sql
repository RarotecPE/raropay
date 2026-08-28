-- Corrige despesas que pertencem a remessas aprovadas mas não estão com status 'approved'
-- Isso pode acontecer se a remessa foi aprovada antes da correção do código

UPDATE expenses e
SET status = 'approved', updated_at = NOW()
FROM expense_batches eb
WHERE e.batch_id = eb.id 
  AND eb.status = 'approved' 
  AND e.status != 'approved' 
  AND e.status != 'rejected';

-- Mostra quantas despesas foram atualizadas
SELECT 
  e.id,
  e.category,
  e.amount,
  e.status as expense_status,
  eb.status as batch_status,
  e.user_id
FROM expenses e
JOIN expense_batches eb ON e.batch_id = eb.id
WHERE eb.status = 'approved';
