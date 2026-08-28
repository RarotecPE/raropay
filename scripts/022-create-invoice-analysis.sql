-- Tabela para solicitações de análise de fatura
CREATE TABLE IF NOT EXISTS invoice_analysis_requests (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES card_invoices(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, resolved, closed
  subject VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(invoice_id, employee_id, status) -- Evita duplicatas de solicitações pendentes
);

-- Tabela para mensagens da análise (thread de conversa)
CREATE TABLE IF NOT EXISTS invoice_analysis_messages (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES invoice_analysis_requests(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para anexos das mensagens
CREATE TABLE IF NOT EXISTS invoice_analysis_attachments (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES invoice_analysis_messages(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_type VARCHAR(100),
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_analysis_requests_invoice ON invoice_analysis_requests(invoice_id);
CREATE INDEX IF NOT EXISTS idx_analysis_requests_employee ON invoice_analysis_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_analysis_requests_status ON invoice_analysis_requests(status);
CREATE INDEX IF NOT EXISTS idx_analysis_messages_request ON invoice_analysis_messages(request_id);
CREATE INDEX IF NOT EXISTS idx_analysis_attachments_message ON invoice_analysis_attachments(message_id);

-- Remover a constraint UNIQUE que pode causar problemas (permite múltiplas solicitações)
ALTER TABLE invoice_analysis_requests DROP CONSTRAINT IF EXISTS invoice_analysis_requests_invoice_id_employee_id_status_key;
