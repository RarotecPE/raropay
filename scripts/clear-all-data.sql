-- Script para limpar todos os dados do banco de dados
-- Mantém a estrutura das tabelas, apenas remove os dados

-- Limpar tabelas na ordem correta (respeitando dependências)
DELETE FROM expense_history;
DELETE FROM expenses;
DELETE FROM expense_batches;
DELETE FROM vehicles;
DELETE FROM category_limits;
DELETE FROM users;

-- Confirmar limpeza
SELECT 'Dados limpos com sucesso!' as status;
