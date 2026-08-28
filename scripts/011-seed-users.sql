-- Criar usuários de teste
-- Senha para todos: 123456 (hash bcrypt)

INSERT INTO users (name, email, password_hash, role, department, cpf, active) VALUES
-- Admin
('Administrador', 'admin@empresa.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin', 'TI', '11111111111', true),

-- Financeiro
('Maria Financeiro', 'financeiro@empresa.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'financial', 'Financeiro', '22222222222', true),

-- Gestor
('Carlos Gestor', 'gestor@empresa.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'manager', 'Comercial', '33333333333', true),

-- Funcionários
('João Silva', 'joao@empresa.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'employee', 'Comercial', '44444444444', true),
('Ana Santos', 'ana@empresa.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'employee', 'Marketing', '55555555555', true),
('Pedro Oliveira', 'pedro@empresa.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'employee', 'Operações', '66666666666', true)

ON CONFLICT (email) DO NOTHING;

-- Criar limites de categoria padrão
INSERT INTO category_limits (category, daily_limit, category_name, alert_threshold) VALUES
('food', 50.00, 'Alimentação', 80),
('accommodation', 200.00, 'Hospedagem', 80),
('fuel', 300.00, 'Combustível', 80),
('transport', 100.00, 'Deslocamento', 80),
('parking', 50.00, 'Estacionamento', 80),
('office_supplies', 500.00, 'Material de Escritório', 80),
('other', 200.00, 'Outras despesas', 80)
ON CONFLICT (category) DO NOTHING;
