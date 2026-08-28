-- Limpar todas as despesas e remessas para novos testes
-- ATENÇÃO: Este script apaga TODOS os dados de despesas e remessas!

-- Primeiro, limpar as despesas (que têm FK para batches)
DELETE FROM expenses;

-- Depois, limpar as remessas
DELETE FROM expense_batches;

-- Resetar os IDs (sequences) para começar do 1
ALTER SEQUENCE expenses_id_seq RESTART WITH 1;
ALTER SEQUENCE expense_batches_id_seq RESTART WITH 1;
