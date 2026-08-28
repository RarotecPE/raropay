-- Adicionar colunas faltantes na tabela expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS accommodation_name VARCHAR(200);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS accommodation_cnpj VARCHAR(20);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS checkin_date DATE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS checkout_date DATE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS daily_rate DECIMAL(10,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS location_type VARCHAR(20);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS has_breakfast BOOLEAN DEFAULT false;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS establishment_cnpj VARCHAR(20);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS number_of_people INTEGER;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(10);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS km_before DECIMAL(10,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS km_after DECIMAL(10,2);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS gas_station_name VARCHAR(200);

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS parking_name VARCHAR(200);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS parking_cnpj VARCHAR(20);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS entry_time TIME;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS exit_time TIME;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS transport_type VARCHAR(30);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS origin VARCHAR(200);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS destination VARCHAR(200);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS distance_km DECIMAL(10,2);

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS current_installment INTEGER DEFAULT 1;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_barcode VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_pix TEXT;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS third_party_name VARCHAR(200);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS third_party_cpf VARCHAR(14);

-- Adicionar colunas faltantes na tabela vehicles
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS km_per_liter DECIMAL(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS owner_type VARCHAR(20) DEFAULT 'company';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id);

-- Atualizar fuel_type para permitir mais tipos
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_fuel_type_check;
