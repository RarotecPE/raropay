-- Adicionar coluna read_at à tabela de mensagens
ALTER TABLE invoice_analysis_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Renomear user_id para sender_id na tabela de mensagens para clareza
ALTER TABLE invoice_analysis_messages RENAME COLUMN user_id TO sender_id;

-- Renomear requested_by para requester_id na tabela de solicitações para consistência
ALTER TABLE invoice_analysis_requests RENAME COLUMN requested_by TO requester_id;

-- Modificar a tabela de anexos para permitir anexos diretos na solicitação (não apenas em mensagens)
ALTER TABLE invoice_analysis_attachments DROP CONSTRAINT IF EXISTS invoice_analysis_attachments_message_id_fkey;
ALTER TABLE invoice_analysis_attachments ALTER COLUMN message_id DROP NOT NULL;
ALTER TABLE invoice_analysis_attachments ADD COLUMN IF NOT EXISTS request_id INTEGER REFERENCES invoice_analysis_requests(id) ON DELETE CASCADE;
ALTER TABLE invoice_analysis_attachments ADD COLUMN IF NOT EXISTS uploaded_by INTEGER REFERENCES users(id);

-- Índice para anexos por request
CREATE INDEX IF NOT EXISTS idx_analysis_attachments_request ON invoice_analysis_attachments(request_id);
