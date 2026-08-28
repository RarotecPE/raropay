-- =====================================================
-- EXPANSÃO DO SCHEMA - Sistema Financeiro Rarotec
-- Script corrigido para remover constraints antigas
-- =====================================================

-- 1. TABELA DE VEÍCULOS
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  plate VARCHAR(10) NOT NULL UNIQUE,
  model VARCHAR(100) NOT NULL,
  brand VARCHAR(100) NOT NULL,
  year INTEGER,
  fuel_type VARCHAR(20) NOT NULL CHECK (fuel_type IN ('gasoline', 'ethanol', 'diesel', 'electric', 'flex')),
  driver_id INTEGER REFERENCES users(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. ADICIONAR CAMPOS NA TABELA USERS
ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf VARCHAR(11);
ALTER TABLE users ADD COLUMN IF NOT EXISTS surname VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pix_key VARCHAR(100);

-- 3. REMOVER CHECK CONSTRAINT ANTIGA DA TABELA CATEGORY_LIMITS
ALTER TABLE category_limits DROP CONSTRAINT IF EXISTS category_limits_category_check;

-- 4. ADICIONAR NOVOS CAMPOS NA TABELA CATEGORY_LIMITS
ALTER TABLE category_limits ADD COLUMN IF NOT EXISTS limit_type VARCHAR(30);
ALTER TABLE category_limits ADD COLUMN IF NOT EXISTS sub_category VARCHAR(50);
ALTER TABLE category_limits ADD COLUMN IF NOT EXISTS min_km_per_liter DECIMAL(10,2);

-- 5. ATUALIZAR E INSERIR LIMITES
UPDATE category_limits SET daily_limit = 180.00, limit_type = 'interior' WHERE category = 'accommodation';
UPDATE category_limits SET min_km_per_liter = 10.00 WHERE category = 'fuel';

-- Hospedagem Capital
INSERT INTO category_limits (category, category_name, daily_limit, limit_type, alert_threshold)
VALUES ('accommodation_capital', 'Hospedagem Capital', 230.00, 'capital', 80)
ON CONFLICT (category) DO UPDATE SET daily_limit = 230.00, limit_type = 'capital';

-- Refeições
INSERT INTO category_limits (category, category_name, daily_limit, sub_category, alert_threshold)
VALUES ('food_breakfast', 'Café da Manhã', 30.00, 'breakfast', 80)
ON CONFLICT (category) DO UPDATE SET daily_limit = 30.00, sub_category = 'breakfast';

INSERT INTO category_limits (category, category_name, daily_limit, sub_category, alert_threshold)
VALUES ('food_lunch', 'Almoço', 40.00, 'lunch', 80)
ON CONFLICT (category) DO UPDATE SET daily_limit = 40.00, sub_category = 'lunch';

INSERT INTO category_limits (category, category_name, daily_limit, sub_category, alert_threshold)
VALUES ('food_dinner', 'Jantar', 30.00, 'dinner', 80)
ON CONFLICT (category) DO UPDATE SET daily_limit = 30.00, sub_category = 'dinner';

-- 6. EXPANDIR TABELA EXPENSES COM NOVOS CAMPOS

-- Campos gerais
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS installment_type VARCHAR(10) DEFAULT 'single';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS installment_number INTEGER DEFAULT 1;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS total_installments INTEGER DEFAULT 1;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS linked_employees JSONB DEFAULT '[]';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS linked_external_parties JSONB DEFAULT '[]';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS pix_code TEXT;

-- Campos de Hospedagem
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS check_in DATE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS check_out DATE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS nights_count INTEGER;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS single_room_value DECIMAL(10,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS single_room_qty INTEGER DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS double_room_value DECIMAL(10,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS double_room_qty INTEGER DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS triple_room_value DECIMAL(10,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS triple_room_qty INTEGER DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS extra_expenses JSONB DEFAULT '[]';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_capital BOOLEAN DEFAULT false;

-- Campos de Alimentação
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS meal_type VARCHAR(20);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS meal_time TIME;

-- Campos de Combustível
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS trip_type VARCHAR(30);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS departure_city VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS arrival_city VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS stops JSONB DEFAULT '[]';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS total_km DECIMAL(10,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_irregular_route BOOLEAN DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(20);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vehicle_id INTEGER REFERENCES vehicles(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS liters DECIMAL(10,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS price_per_liter DECIMAL(10,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS km_per_liter DECIMAL(10,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS odometer_photos JSONB DEFAULT '[]';

-- Campos de Deslocamento
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_round_trip BOOLEAN DEFAULT false;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS different_arrival BOOLEAN DEFAULT false;

-- Campos de Estacionamento
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS parking_type VARCHAR(30);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS establishment_name VARCHAR(200);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS parking_reason VARCHAR(30);

-- Campos de Itens de Escritório / Outras Despesas
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS establishment_type VARCHAR(20);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS purchase_reason VARCHAR(30);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS requester VARCHAR(200);

-- 7. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id ON vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_active ON vehicles(active);
