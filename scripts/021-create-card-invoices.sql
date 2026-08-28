-- Criar tabela de faturas do cartão corporativo
CREATE TABLE IF NOT EXISTS card_invoices (
  id SERIAL PRIMARY KEY,
  reference_month VARCHAR(7) NOT NULL, -- Formato: YYYY-MM (ex: 2026-01)
  reference_name VARCHAR(100) NOT NULL, -- Nome amigável (ex: "Janeiro 2026")
  start_date DATE NOT NULL, -- Data de início do período (despesas a partir de)
  end_date DATE NOT NULL, -- Data de fechamento (despesas até)
  due_date DATE NOT NULL, -- Data de vencimento da fatura
  notes TEXT, -- Observações opcionais
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_card_invoices_reference_month ON card_invoices(reference_month);
CREATE INDEX IF NOT EXISTS idx_card_invoices_dates ON card_invoices(start_date, end_date);

-- Constraint para garantir que start_date < end_date
ALTER TABLE card_invoices ADD CONSTRAINT check_dates CHECK (start_date < end_date);
