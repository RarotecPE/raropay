-- Criar tabela de remessas de prestação de contas
CREATE TABLE IF NOT EXISTS expense_batches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Status da remessa
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'partial', 'rejected', 'correction')),
  
  -- Tipo de liquidação predominante (baseado nas despesas)
  settlement_type VARCHAR(30) CHECK (settlement_type IN ('cartao_corporativo', 'adiantamento', 'reembolso', 'misto')),
  
  -- Para adiantamentos: saldo do funcionário
  advance_balance VARCHAR(20) CHECK (advance_balance IN ('positivo', 'negativo', 'zero')),
  advance_balance_amount DECIMAL(10, 2) DEFAULT 0, -- Valor do saldo (positivo = devolver, negativo = receber)
  
  -- Método de reembolso (quando aplicável)
  refund_method VARCHAR(20) CHECK (refund_method IN ('conta_bb', 'boleto')),
  
  -- Dados bancários para reembolso via conta BB
  bank_account_data JSONB,
  
  -- Dados do boleto (quando método = boleto)
  bank_slip_data JSONB,
  -- Estrutura esperada do bank_slip_data:
  -- {
  --   "banco": "Banco do Brasil",
  --   "linha_digitavel": "23793.38128 60000.000003 00000.000400 1 84340000012345",
  --   "codigo_barras": "23791843400000123450000000000000000000000040",
  --   "valor": 123.45,
  --   "vencimento": "2024-01-15",
  --   "beneficiario": "Empresa XYZ Ltda",
  --   "cnpj_beneficiario": "12.345.678/0001-90"
  -- }
  
  -- Observações do funcionário
  observations TEXT,
  
  -- Observações do financeiro (ao aprovar/rejeitar)
  finance_observations TEXT,
  
  -- Totais
  total_amount DECIMAL(10, 2) DEFAULT 0,
  total_expenses INTEGER DEFAULT 0,
  
  -- Quem aprovou/rejeitou
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Adicionar campo batch_id na tabela expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS batch_id INTEGER REFERENCES expense_batches(id);

-- Adicionar novos status na tabela expenses se não existirem
-- Status: draft, processed, submitted, correction, approved, rejected
-- Nota: O status 'pending' será migrado para 'processed' no novo fluxo

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_expense_batches_user_id ON expense_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_batches_status ON expense_batches(status);
CREATE INDEX IF NOT EXISTS idx_expense_batches_created_at ON expense_batches(created_at);
CREATE INDEX IF NOT EXISTS idx_expenses_batch_id ON expenses(batch_id);

-- Comentários nas colunas
COMMENT ON TABLE expense_batches IS 'Remessas de prestação de contas agrupando múltiplas despesas';
COMMENT ON COLUMN expense_batches.settlement_type IS 'Tipo predominante: cartao_corporativo, adiantamento, reembolso ou misto';
COMMENT ON COLUMN expense_batches.advance_balance IS 'Para adiantamentos: positivo (sobrou), negativo (faltou), zero (exato)';
COMMENT ON COLUMN expense_batches.refund_method IS 'Método de reembolso: conta_bb ou boleto';
