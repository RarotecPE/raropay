-- Script para limpar todas as despesas (para testes)
-- Executar com cuidado - apaga todos os dados!

-- Limpar lotes primeiro (se existir)
DELETE FROM expense_batches;

-- Limpar todas as despesas
DELETE FROM expenses;
