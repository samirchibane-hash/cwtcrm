-- Create allowed_emails table for whitelisting
CREATE TABLE public.allowed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can view allowed emails (for admin purposes)
CREATE POLICY "Authenticated users can view allowed_emails"
ON public.allowed_emails
FOR SELECT
TO authenticated
USING (true);

-- Only authenticated users can manage allowed emails
CREATE POLICY "Authenticated users can insert allowed_emails"
ON public.allowed_emails
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete allowed_emails"
ON public.allowed_emails
FOR DELETE
TO authenticated
USING (true);

-- Create function to check if email is allowed (used during signup validation)
CREATE OR REPLACE FUNCTION public.is_email_allowed(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.allowed_emails
    WHERE LOWER(email) = LOWER(check_email)
  )
$$;