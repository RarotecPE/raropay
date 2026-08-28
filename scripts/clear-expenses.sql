-- Script para limpar todas as despesas da base de dados
-- Isso remove TODAS as despesas para permitir testes limpos

-- Limpar tabela de despesas
DELETE FROM expenses;

-- Resetar a sequência do ID (opcional, para IDs começarem do 1 novamente)
-- ALTER SEQUENCE expenses_id_seq RESTART WITH 1;

SELECT 'Todas as despesas foram removidas com sucesso!' AS resultado;
