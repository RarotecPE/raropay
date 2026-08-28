-- Add estimated_distance column to expenses table
-- This stores the system-calculated distance based on departure/arrival cities

ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS estimated_distance NUMERIC;

-- Add comment
COMMENT ON COLUMN expenses.estimated_distance IS 'System-calculated distance based on departure and arrival cities';
