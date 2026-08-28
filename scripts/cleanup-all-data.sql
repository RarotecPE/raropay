-- Limpar todas as despesas e lotes para nova rodada de testes
-- Este script remove todos os dados de despesas

-- Limpar tabela de despesas
DELETE FROM expenses;

-- Limpar tabela de lotes de despesas (se existir)
DELETE FROM expense_batches;

-- Confirmar limpeza
SELECT 'Dados de despesas limpos com sucesso' as status;
