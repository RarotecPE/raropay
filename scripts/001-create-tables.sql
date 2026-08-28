-- Sistema Financeiro Rarotec - Criação das Tabelas

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'manager', 'director')),
  department VARCHAR(255),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de limites por categoria
CREATE TABLE IF NOT EXISTS category_limits (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL UNIQUE CHECK (category IN ('accommodation', 'food', 'fuel', 'transport', 'parking', 'office_supplies', 'other')),
  category_name VARCHAR(100) NOT NULL,
  daily_limit DECIMAL(10, 2) NOT NULL,
  alert_threshold DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de despesas
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expense_type VARCHAR(50) NOT NULL CHECK (expense_type IN ('corporate_card', 'advance', 'reimbursement')),
  category VARCHAR(50) NOT NULL CHECK (category IN ('accommodation', 'food', 'fuel', 'transport', 'parking', 'office_supplies', 'other')),
  description TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  expense_date DATE NOT NULL,
  municipality VARCHAR(255),
  state VARCHAR(2),
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'analysis')),
  receipt_url TEXT,
  receipt_pathname TEXT,
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de histórico de ações
CREATE TABLE IF NOT EXISTS expense_history (
  id SERIAL PRIMARY KEY,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  notes TEXT,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expense_history_expense_id ON expense_history(expense_id);
