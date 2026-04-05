
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'New Order';

CREATE OR REPLACE FUNCTION public.create_order_with_items(p_invoice_code text, p_customer_id uuid, p_created_by uuid, p_customer_name text, p_customer_phone text, p_customer_address text, p_advance numeric, p_cod numeric, p_note text, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id UUID;
  v_item JSONB;
  v_product products;
  v_subtotal NUMERIC;
  v_order_value NUMERIC := 0;
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id FROM public.users WHERE auth_id = p_created_by;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'User has no organization';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM products
      WHERE id = (v_item->>'product_id')::UUID AND deleted_at IS NULL AND organization_id = v_org_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_item->>'product_id';
    END IF;
    IF v_product.stock < (v_item->>'quantity')::INT THEN
      RAISE EXCEPTION 'Insufficient stock for %: only % left', v_product.name, v_product.stock;
    END IF;
    v_order_value := v_order_value + (v_product.price * (v_item->>'quantity')::INT);
  END LOOP;

  INSERT INTO orders (invoice_code, customer_id, created_by,
    customer_name, customer_phone, customer_address,
    order_value, advance, total_due, cod, note, organization_id, status)
  VALUES (p_invoice_code, p_customer_id, p_created_by,
    p_customer_name, p_customer_phone, p_customer_address,
    v_order_value, p_advance, v_order_value - p_advance, p_cod, p_note, v_org_id, 'New Order')
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_product FROM products
      WHERE id = (v_item->>'product_id')::UUID;
    v_subtotal := v_product.price * (v_item->>'quantity')::INT;
    INSERT INTO order_items (order_id, product_id, product_name, product_code,
      quantity, unit_price, subtotal, organization_id)
    VALUES (v_order_id, v_product.id, v_product.name, v_product.code,
      (v_item->>'quantity')::INT, v_product.price, v_subtotal, v_org_id);
    UPDATE products SET stock = stock - (v_item->>'quantity')::INT
      WHERE id = v_product.id;
  END LOOP;

  RETURN v_order_id;
END;
$function$;
