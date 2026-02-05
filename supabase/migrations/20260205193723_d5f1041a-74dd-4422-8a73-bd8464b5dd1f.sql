
-- Add lead_tier column to prospects table
ALTER TABLE public.prospects ADD COLUMN lead_tier text DEFAULT '' NOT NULL;
