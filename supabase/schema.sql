-- ============================================================
-- CWT CRM - Full Schema (consolidated from all migrations)
-- Run this in your Supabase SQL Editor to set up the database
-- ============================================================

-- ── update_updated_at_column trigger function ────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── product_models ───────────────────────────────────────────
CREATE TABLE public.product_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  pricing_tiers JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view product_models"   ON public.product_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert product_models" ON public.product_models FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update product_models" ON public.product_models FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete product_models" ON public.product_models FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_product_models_updated_at
  BEFORE UPDATE ON public.product_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── orders ───────────────────────────────────────────────────
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_number TEXT NOT NULL,
  company TEXT NOT NULL,
  order_total TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  order_type TEXT NOT NULL DEFAULT 'Standard',
  model_type TEXT DEFAULT '',
  model_items JSONB NOT NULL DEFAULT '[]',
  total_value NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view orders"   ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update orders" ON public.orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete orders" ON public.orders FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── allowed_emails ───────────────────────────────────────────
CREATE TABLE public.allowed_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  notes TEXT
);

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view allowed_emails"   ON public.allowed_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert allowed_emails" ON public.allowed_emails FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete allowed_emails" ON public.allowed_emails FOR DELETE TO authenticated USING (true);

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

-- ── prospects ────────────────────────────────────────────────
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
  website TEXT DEFAULT '',
  starred BOOLEAN NOT NULL DEFAULT false,
  lead_tier TEXT NOT NULL DEFAULT '',
  street TEXT DEFAULT '',
  city TEXT DEFAULT '',
  zip TEXT DEFAULT '',
  country TEXT DEFAULT '',
  google_maps_url TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view prospects"   ON public.prospects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert prospects" ON public.prospects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update prospects" ON public.prospects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete prospects" ON public.prospects FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_prospects_updated_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
