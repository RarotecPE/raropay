-- Excluir a solicitação restante "Tesntando 2"

-- Primeiro, excluir despesas vinculadas
DELETE FROM invoice_analysis_expenses 
WHERE request_id IN (SELECT id FROM invoice_analysis_requests WHERE subject ILIKE '%tesntando%');

-- Excluir anexos
DELETE FROM invoice_analysis_attachments 
WHERE request_id IN (SELECT id FROM invoice_analysis_requests WHERE subject ILIKE '%tesntando%');

-- Excluir mensagens
DELETE FROM invoice_analysis_messages 
WHERE request_id IN (SELECT id FROM invoice_analysis_requests WHERE subject ILIKE '%tesntando%');

-- Excluir a solicitação
DELETE FROM invoice_analysis_requests WHERE subject ILIKE '%tesntando%';
