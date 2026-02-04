-- Add starred column to prospects table for VIP marking
ALTER TABLE public.prospects 
ADD COLUMN starred boolean NOT NULL DEFAULT false;