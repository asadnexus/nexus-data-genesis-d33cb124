
-- 1. Drop the global unique constraint on invoice_code
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_invoice_code_key;

-- 2. Add org-scoped unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS orders_invoice_code_org_unique 
ON public.orders (organization_id, invoice_code) WHERE deleted_at IS NULL;

-- 3. Rewrite generate_invoice_code to scope by organization
CREATE OR REPLACE FUNCTION public.generate_invoice_code(p_created_by uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_max_letter CHAR(1) := 'A';
  v_max_num INTEGER := 0;
  v_letter CHAR(1);
  v_num INTEGER;
  v_next_num INTEGER;
  v_next_letter CHAR(1);
  v_org_id UUID;
  rec RECORD;
BEGIN
  -- Get user's organization
  SELECT organization_id INTO v_org_id FROM public.users WHERE auth_id = p_created_by;

  FOR rec IN
    SELECT invoice_code FROM orders
    WHERE organization_id = v_org_id
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

  IF v_max_num = 0 THEN
    RETURN 'A0001';
  END IF;

  IF v_max_num + 1 > 9999 THEN
    v_next_letter := CHR(ASCII(v_max_letter) + 1);
    v_next_num := 1;
  ELSE
    v_next_letter := v_max_letter;
    v_next_num := v_max_num + 1;
  END IF;

  RETURN v_next_letter || LPAD(v_next_num::TEXT, 4, '0');
END;
$function$;
