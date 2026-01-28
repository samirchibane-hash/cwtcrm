-- Create prospects table
CREATE TABLE public.prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  state TEXT DEFAULT '',
  type TEXT DEFAULT '',
  market_type TEXT DEFAULT '',
  stage TEXT DEFAULT '',
  last_contact TEXT DEFAULT '',
  engagement_notes TEXT DEFAULT '',
  linkedin TEXT DEFAULT '',
  contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  engagements JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users only
CREATE POLICY "Authenticated users can view prospects"
ON public.prospects
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert prospects"
ON public.prospects
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update prospects"
ON public.prospects
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete prospects"
ON public.prospects
FOR DELETE
TO authenticated
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_prospects_updated_at
BEFORE UPDATE ON public.prospects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();