-- Adicionar coluna edit_notes na tabela invoice_analysis_expenses
ALTER TABLE invoice_analysis_expenses 
ADD COLUMN IF NOT EXISTS edit_notes TEXT;
