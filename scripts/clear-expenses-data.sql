-- Script para limpar todos os dados de despesas para testes

-- Limpar histórico de despesas
DELETE FROM expense_history;

-- Limpar despesas
DELETE FROM expenses;

-- Limpar remessas/batches
DELETE FROM expense_batches;

-- Confirmar limpeza
SELECT 'Dados limpos com sucesso!' as status;
SELECT 'Despesas restantes:' as info, COUNT(*) as count FROM expenses;
SELECT 'Remessas restantes:' as info, COUNT(*) as count FROM expense_batches;
