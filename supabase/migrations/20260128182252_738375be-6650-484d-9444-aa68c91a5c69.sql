-- Drop existing overly permissive RLS policies on orders table
DROP POLICY IF EXISTS "Allow public delete access on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public insert access on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public read access on orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public update access on orders" ON public.orders;

-- Drop existing overly permissive RLS policies on product_models table
DROP POLICY IF EXISTS "Allow public delete access on product_models" ON public.product_models;
DROP POLICY IF EXISTS "Allow public insert access on product_models" ON public.product_models;
DROP POLICY IF EXISTS "Allow public read access on product_models" ON public.product_models;
DROP POLICY IF EXISTS "Allow public update access on product_models" ON public.product_models;

-- Create new secure RLS policies for orders table (authenticated users only)
CREATE POLICY "Authenticated users can view orders"
ON public.orders
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete orders"
ON public.orders
FOR DELETE
TO authenticated
USING (true);

-- Create new secure RLS policies for product_models table (authenticated users only)
CREATE POLICY "Authenticated users can view product_models"
ON public.product_models
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert product_models"
ON public.product_models
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update product_models"
ON public.product_models
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete product_models"
ON public.product_models
FOR DELETE
TO authenticated
USING (true);

-- Fix the function search_path security issue
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;