-- Tabela de vínculo entre solicitações de análise e despesas específicas
CREATE TABLE IF NOT EXISTS invoice_analysis_expenses (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES invoice_analysis_requests(id) ON DELETE CASCADE,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  reason TEXT, -- Motivo pelo qual esta despesa precisa de revisão
  fields_to_review TEXT[], -- Campos específicos a revisar: ['date', 'amount', 'category', 'description']
  original_values JSONB, -- Snapshot dos valores originais no momento da solicitação
  status VARCHAR(20) DEFAULT 'pending', -- pending, edited, approved
  edited_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(request_id, expense_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_analysis_expenses_request ON invoice_analysis_expenses(request_id);
CREATE INDEX IF NOT EXISTS idx_analysis_expenses_expense ON invoice_analysis_expenses(expense_id);
CREATE INDEX IF NOT EXISTS idx_analysis_expenses_status ON invoice_analysis_expenses(status);
