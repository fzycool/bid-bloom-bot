
-- Add document_structure column to store the overall structure analysis
ALTER TABLE public.bid_analyses ADD COLUMN IF NOT EXISTS document_structure jsonb DEFAULT NULL;
