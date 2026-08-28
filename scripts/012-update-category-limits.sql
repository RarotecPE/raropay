-- Primeiro, remover a constraint única da categoria (para permitir subcategorias)
ALTER TABLE category_limits DROP CONSTRAINT IF EXISTS category_limits_category_key;

-- Criar constraint única composta (category + sub_category)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'category_limits_category_sub_key') THEN
    ALTER TABLE category_limits ADD CONSTRAINT category_limits_category_sub_key UNIQUE (category, sub_category);
  END IF;
END $$;

-- Limpar limites existentes
DELETE FROM category_limits;

-- Inserir limites reais
INSERT INTO category_limits (category, sub_category, category_name, daily_limit, alert_threshold, min_km_per_liter) VALUES
-- Hospedagem
('accommodation', 'capital', 'Hospedagem - Capital', 300.00, 80, NULL),
('accommodation', 'interior', 'Hospedagem - Interior', 200.00, 80, NULL),

-- Alimentação
('food', 'breakfast', 'Alimentação - Café da Manhã', 25.00, 80, NULL),
('food', 'lunch', 'Alimentação - Almoço', 50.00, 80, NULL),
('food', 'dinner', 'Alimentação - Jantar', 50.00, 80, NULL),

-- Combustível (com km/l mínimo)
('fuel', NULL, 'Combustível', 0.00, 80, 10.00);
