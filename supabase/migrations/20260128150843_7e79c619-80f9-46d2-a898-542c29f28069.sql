-- Create product_models table
CREATE TABLE public.product_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  pricing_tiers JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table
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

-- Enable RLS (with public access for now - no auth required)
ALTER TABLE public.product_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access (since no auth is implemented)
CREATE POLICY "Allow public read access on product_models" ON public.product_models FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on product_models" ON public.product_models FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on product_models" ON public.product_models FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on product_models" ON public.product_models FOR DELETE USING (true);

CREATE POLICY "Allow public read access on orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on orders" ON public.orders FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on orders" ON public.orders FOR DELETE USING (true);

-- Create update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_product_models_updated_at
  BEFORE UPDATE ON public.product_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();