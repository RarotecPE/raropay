-- Atualizar valores de referência (não são limites, apenas referências)
UPDATE category_limits SET daily_limit = 230 WHERE category = 'accommodation' AND sub_category = 'capital';
UPDATE category_limits SET daily_limit = 180 WHERE category = 'accommodation' AND sub_category = 'interior';
UPDATE category_limits SET daily_limit = 30 WHERE category = 'food' AND sub_category = 'breakfast';
UPDATE category_limits SET daily_limit = 40 WHERE category = 'food' AND sub_category = 'lunch';
UPDATE category_limits SET daily_limit = 30 WHERE category = 'food' AND sub_category = 'dinner';
UPDATE category_limits SET min_km_per_liter = 10 WHERE category = 'fuel';

-- Atualizar nomes das categorias para "Referência"
UPDATE category_limits SET category_name = 'Hospedagem - Capital' WHERE category = 'accommodation' AND sub_category = 'capital';
UPDATE category_limits SET category_name = 'Hospedagem - Interior' WHERE category = 'accommodation' AND sub_category = 'interior';
UPDATE category_limits SET category_name = 'Café da Manhã' WHERE category = 'food' AND sub_category = 'breakfast';
UPDATE category_limits SET category_name = 'Almoço' WHERE category = 'food' AND sub_category = 'lunch';
UPDATE category_limits SET category_name = 'Jantar' WHERE category = 'food' AND sub_category = 'dinner';
UPDATE category_limits SET category_name = 'Combustível' WHERE category = 'fuel';
