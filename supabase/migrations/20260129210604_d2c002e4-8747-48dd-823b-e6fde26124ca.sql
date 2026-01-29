-- Add website column to prospects table
ALTER TABLE public.prospects 
ADD COLUMN IF NOT EXISTS website text DEFAULT '';