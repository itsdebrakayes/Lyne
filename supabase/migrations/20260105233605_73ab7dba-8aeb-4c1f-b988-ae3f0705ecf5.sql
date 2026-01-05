-- Add TRN column to clients table (Jamaican Tax Registration Number)
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS trn_number text;

-- Create index on TRN for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_trn ON public.clients(trn_number);