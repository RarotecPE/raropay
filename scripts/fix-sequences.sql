-- ==============================================================================
-- Script: scripts/fix-sequences.sql
-- Descrição: Sincroniza todas as sequences (SERIAL/BIGSERIAL/IDENTITY) com o
--            maior ID existente de cada tabela no schema public.
--
-- Uso: Execute este script após restaurar backups ou importar dumps de dados.
--      Isso previne o erro:
--      "duplicate key value violates unique constraint '..._pkey'"
-- ==============================================================================

DO $$
DECLARE
    r RECORD;
    v_max_id BIGINT;
    v_sql TEXT;
BEGIN
    RAISE NOTICE 'Iniciando sincronização de sequences...';

    FOR r IN
        SELECT 
            c.relname AS table_name,
            a.attname AS column_name,
            pg_get_serial_sequence(quote_ident(c.relname), quote_ident(a.attname)) AS sequence_name
        FROM pg_class c
        JOIN pg_attribute a ON a.attrelid = c.oid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND pg_get_serial_sequence(quote_ident(c.relname), quote_ident(a.attname)) IS NOT NULL
        ORDER BY c.relname
    LOOP
        BEGIN
            -- Descobre o maior ID atual na tabela
            EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I', r.column_name, r.table_name)
            INTO v_max_id;

            IF v_max_id > 0 THEN
                -- Define o valor da sequence para o maior ID e marca como chamado (próximo será v_max_id + 1)
                EXECUTE format('SELECT setval(%L, %s, true)', r.sequence_name, v_max_id);
                RAISE NOTICE 'Tabela %.% (sequence %) sincronizada para % (próximo: %)', 
                             r.table_name, r.column_name, r.sequence_name, v_max_id, v_max_id + 1;
            ELSE
                -- Se a tabela estiver vazia, reinicia para 1 não chamado (próximo será 1)
                EXECUTE format('SELECT setval(%L, 1, false)', r.sequence_name);
                RAISE NOTICE 'Tabela %.% vazia. Sequence % redefinida para 1', 
                             r.table_name, r.column_name, r.sequence_name;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Não foi possível sincronizar %.%: %', r.table_name, r.column_name, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE 'Sincronização concluída com sucesso!';
END $$;
