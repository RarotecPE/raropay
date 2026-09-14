-- Atualiza constraint de categoria para incluir novas categorias introduzidas nas features
-- meal_voucher, transport_voucher, etc.

-- Remove constraint antiga se existir (nome pode variar, tenta ambos)
DO $$
BEGIN
  -- expenses category
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_category_check') THEN
    ALTER TABLE expenses DROP CONSTRAINT expenses_category_check;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_category_check1') THEN
    ALTER TABLE expenses DROP CONSTRAINT expenses_category_check1;
  END IF;
  -- category_limits
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'category_limits_category_check') THEN
    ALTER TABLE category_limits DROP CONSTRAINT category_limits_category_check;
  END IF;
END $$;

-- Recria com categorias expandidas
ALTER TABLE expenses ADD CONSTRAINT expenses_category_check
  CHECK (category IN (
    'accommodation', 'food', 'fuel', 'transport', 'parking',
    'office_supplies', 'other',
    'meal_voucher', 'transport_voucher',
    'toll', 'mileage', 'other_transport'
  ));

ALTER TABLE category_limits ADD CONSTRAINT category_limits_category_check
  CHECK (category IN (
    'accommodation', 'food', 'fuel', 'transport', 'parking',
    'office_supplies', 'other',
    'meal_voucher', 'transport_voucher',
    'toll', 'mileage', 'other_transport',
    'capital', 'interior', 'breakfast', 'lunch', 'dinner',
    'accommodation_capital', 'food_breakfast', 'food_lunch', 'food_dinner'
  ));

-- Garante colunas de vale-refeição existem (caso ainda não)
ALTER TABLE users ADD COLUMN IF NOT EXISTS meal_voucher_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS meal_voucher_limit NUMERIC(10,2) DEFAULT 250;

-- Garante colunas de transporte
ALTER TABLE users ADD COLUMN IF NOT EXISTS transport_voucher_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS transport_voucher_limit NUMERIC(10,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS transport_voucher_type VARCHAR(20) CHECK (transport_voucher_type IN ('fuel', 'app', 'public'));
