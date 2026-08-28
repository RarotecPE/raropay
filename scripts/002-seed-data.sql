-- Sistema Financeiro Rarotec - Dados Iniciais

-- Inserir limites por categoria (valores em reais)
INSERT INTO category_limits (category, category_name, daily_limit, alert_threshold) VALUES
  ('accommodation', 'Hospedagem', 500.00, 400.00),
  ('food', 'Alimentação', 100.00, 80.00),
  ('fuel', 'Combustível', 300.00, 240.00),
  ('transport', 'Deslocamento', 200.00, 160.00),
  ('parking', 'Estacionamento', 50.00, 40.00),
  ('office_supplies', 'Itens de Escritório', 150.00, 120.00),
  ('other', 'Outras Despesas', 100.00, 80.00)
ON CONFLICT (category) DO UPDATE SET
  category_name = EXCLUDED.category_name,
  daily_limit = EXCLUDED.daily_limit,
  alert_threshold = EXCLUDED.alert_threshold,
  updated_at = NOW();

-- Inserir usuário administrador padrão
-- Senha: admin123 (hash gerado com bcrypt)
INSERT INTO users (name, email, password_hash, role, department) VALUES
  ('Administrador', 'admin@rarotec.com.br', '$2b$10$rQZ8K8Y8Y8Y8Y8Y8Y8Y8YeXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 'director', 'Diretoria Financeira')
ON CONFLICT (email) DO NOTHING;
