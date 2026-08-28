-- Excluir solicitações de análise de teste

-- Primeiro excluir registros relacionados
DELETE FROM invoice_analysis_expenses 
WHERE request_id IN (
  SELECT id FROM invoice_analysis_requests 
  WHERE subject ILIKE '%test%' OR subject ILIKE '%testando%'
);

DELETE FROM invoice_analysis_attachments 
WHERE request_id IN (
  SELECT id FROM invoice_analysis_requests 
  WHERE subject ILIKE '%test%' OR subject ILIKE '%testando%'
);

DELETE FROM invoice_analysis_messages 
WHERE request_id IN (
  SELECT id FROM invoice_analysis_requests 
  WHERE subject ILIKE '%test%' OR subject ILIKE '%testando%'
);

-- Excluir as solicitações
DELETE FROM invoice_analysis_requests 
WHERE subject ILIKE '%test%' OR subject ILIKE '%testando%';
