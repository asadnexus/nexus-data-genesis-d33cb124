
-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_code TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  created_by UUID NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT,
  order_value NUMERIC NOT NULL DEFAULT 0,
  advance NUMERIC DEFAULT 0,
  total_due NUMERIC NOT NULL DEFAULT 0,
  cod NUMERIC DEFAULT 0,
  note TEXT,
  status TEXT DEFAULT 'Pending',
  tracking_code TEXT,
  invoice_url TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  product_code TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS on orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view orders"
  ON public.orders FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/sub_admin can insert orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'main_admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Admin/sub_admin can update orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'main_admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

-- RLS on order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view order_items"
  ON public.order_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/sub_admin can insert order_items"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'main_admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

-- Invoice code generator function
CREATE OR REPLACE FUNCTION public.generate_invoice_code(p_created_by UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_max_letter CHAR(1) := 'A';
  v_max_num INTEGER := 0;
  v_letter CHAR(1);
  v_num INTEGER;
  v_next_num INTEGER;
  v_next_letter CHAR(1);
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT invoice_code FROM orders
    WHERE created_by = p_created_by
    ORDER BY created_at DESC
    LIMIT 100
  LOOP
    IF rec.invoice_code ~ '^[A-Z]\d{4}$' THEN
      v_letter := LEFT(rec.invoice_code, 1);
      v_num := SUBSTRING(rec.invoice_code FROM 2)::INTEGER;
      IF v_letter > v_max_letter OR (v_letter = v_max_letter AND v_num > v_max_num) THEN
        v_max_letter := v_letter;
        v_max_num := v_num;
      END IF;
    END IF;
  END LOOP;

  IF v_max_num + 1 > 9999 THEN
    v_next_letter := CHR(ASCII(v_max_letter) + 1);
    v_next_num := 1;
  ELSE
    v_next_letter := v_max_letter;
    v_next_num := v_max_num + 1;
  END IF;

  RETURN v_next_letter || LPAD(v_next_num::TEXT, 4, '0');
END;
$$;

-- Atomic order creation with stock validation
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_invoice_code TEXT,
  p_customer_id UUID,
  p_created_by UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_address TEXT,
  p_advance NUMERIC,
  p_cod NUMERIC,
  p_note TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_id UUID;
  v_item JSONB;
  v_product products;
  v_subtotal NUMERIC;
  v_order_value NUMERIC := 0;
BEGIN
  -- 1. Validate ALL stock first
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM products
      WHERE id = (v_item->>'product_id')::UUID AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_item->>'product_id';
    END IF;

    IF v_product.stock < (v_item->>'quantity')::INT THEN
      RAISE EXCEPTION 'Insufficient stock for %: only % left', v_product.name, v_product.stock;
    END IF;

    v_order_value := v_order_value + (v_product.price * (v_item->>'quantity')::INT);
  END LOOP;

  -- 2. Create order header
  INSERT INTO orders (invoice_code, customer_id, created_by,
    customer_name, customer_phone, customer_address,
    order_value, advance, total_due, cod, note)
  VALUES (p_invoice_code, p_customer_id, p_created_by,
    p_customer_name, p_customer_phone, p_customer_address,
    v_order_value, p_advance, v_order_value - p_advance, p_cod, p_note)
  RETURNING id INTO v_order_id;

  -- 3. Insert items + deduct stock atomically
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM products
      WHERE id = (v_item->>'product_id')::UUID;

    v_subtotal := v_product.price * (v_item->>'quantity')::INT;

    INSERT INTO order_items (order_id, product_id, product_name, product_code,
      quantity, unit_price, subtotal)
    VALUES (v_order_id, v_product.id, v_product.name, v_product.code,
      (v_item->>'quantity')::INT, v_product.price, v_subtotal);

    UPDATE products SET stock = stock - (v_item->>'quantity')::INT
      WHERE id = v_product.id;
  END LOOP;

  RETURN v_order_id;
END;
$$;
