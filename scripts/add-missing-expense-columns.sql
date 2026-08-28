-- Adicionar colunas que podem estar faltando na tabela expenses

-- Colunas de combustível/viagem
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS trip_type VARCHAR(50);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS departure_city VARCHAR(255);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS departure_state VARCHAR(2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS arrival_city VARCHAR(255);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS arrival_state VARCHAR(2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS stops JSONB;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_irregular_route BOOLEAN DEFAULT FALSE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_round_trip BOOLEAN DEFAULT FALSE;

-- Colunas de estacionamento
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS parking_type VARCHAR(50);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS parking_reason VARCHAR(255);

-- Colunas de compras/itens
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS store_type VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS store_name VARCHAR(255);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS items JSONB;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS purchase_reason TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS requester VARCHAR(255);

-- Colunas de pessoas vinculadas
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS linked_external_parties JSONB;
