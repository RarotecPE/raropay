-- Adiciona suporte a limite de vale-transporte por usuário e tipo de despesa de VT
-- Unificação da feature branch atualizar-nova-versao-raropay com main (R2 + RaroNexus)

-- Limite mensal de vale-transporte (NULL = ilimitado, apenas acompanhamento)
ALTER TABLE users ADD COLUMN IF NOT EXISTS transport_voucher_limit NUMERIC(10,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS transport_voucher_enabled BOOLEAN DEFAULT FALSE;

-- Tipo de despesa de vale-transporte: fuel, app, public
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS transport_voucher_type VARCHAR(20) CHECK (transport_voucher_type IN ('fuel', 'app', 'public'));

-- Índices para performance nas consultas de VT
CREATE INDEX IF NOT EXISTS idx_users_transport_voucher_enabled ON users(transport_voucher_enabled) WHERE transport_voucher_enabled = true;
CREATE INDEX IF NOT EXISTS idx_expenses_transport_voucher ON expenses(category, user_id, expense_date) WHERE category = 'transport_voucher';

-- Comentários
COMMENT ON COLUMN users.transport_voucher_limit IS 'Limite mensal de vale-transporte em R$. NULL = ilimitado (apenas acompanhamento de gastos)';
COMMENT ON COLUMN expenses.transport_voucher_type IS 'Tipo de vale-transporte: fuel=Combustível, app=Deslocamento por aplicativo, public=Transporte público';
