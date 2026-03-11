
-- ============================================================
-- MULTI-TENANT FOUNDATION MIGRATION
-- ============================================================

-- 1. Create organizations table
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My Organization',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Add organization_id columns (nullable for data migration)
ALTER TABLE public.users ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.user_roles ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.user_permissions ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.orders ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.order_items ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.products ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.customers ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.company_settings ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.invoice_settings ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.invoice_settings_history ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.couriers ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.invitations ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

-- 3. Migrate existing data
DO $$
DECLARE
  v_org_id uuid;
  v_admin_id uuid;
BEGIN
  SELECT u.auth_id INTO v_admin_id
  FROM public.users u
  JOIN public.user_roles ur ON ur.user_id = u.auth_id
  WHERE ur.role = 'main_admin'
  LIMIT 1;

  IF v_admin_id IS NOT NULL THEN
    INSERT INTO public.organizations (name, created_by)
    VALUES ('Default Organization', v_admin_id)
    RETURNING id INTO v_org_id;

    UPDATE public.users SET organization_id = v_org_id;
    UPDATE public.user_roles SET organization_id = v_org_id;
    UPDATE public.user_permissions SET organization_id = v_org_id;
    UPDATE public.orders SET organization_id = v_org_id;
    UPDATE public.order_items SET organization_id = v_org_id;
    UPDATE public.products SET organization_id = v_org_id;
    UPDATE public.customers SET organization_id = v_org_id;
    UPDATE public.company_settings SET organization_id = v_org_id;
    UPDATE public.invoice_settings SET organization_id = v_org_id;
    UPDATE public.invoice_settings_history SET organization_id = v_org_id;
    UPDATE public.couriers SET organization_id = v_org_id;
    UPDATE public.invitations SET organization_id = v_org_id;
  END IF;
END;
$$;

-- 4. Create get_user_org helper (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_org(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.users WHERE auth_id = _user_id LIMIT 1
$$;

-- 5. RLS on organizations
CREATE POLICY "Users can view their org"
  ON public.organizations FOR SELECT TO authenticated
  USING (id = public.get_user_org(auth.uid()));

CREATE POLICY "Authenticated can insert org"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Main admin can update org"
  ON public.organizations FOR UPDATE TO authenticated
  USING (id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'main_admin'));

-- 6. Drop and recreate all RLS policies with org scoping

-- users
DROP POLICY IF EXISTS "Authenticated users can view users" ON public.users;
DROP POLICY IF EXISTS "Main admin can insert users" ON public.users;
DROP POLICY IF EXISTS "Main admin can update users" ON public.users;

CREATE POLICY "Org users can view users" ON public.users
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Org can insert users" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org(auth.uid())
    OR public.get_user_org(auth.uid()) IS NULL
  );

CREATE POLICY "Org admin can update users" ON public.users
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'main_admin'));

-- user_roles
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;
DROP POLICY IF EXISTS "Main admin can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Main admin can update roles" ON public.user_roles;

CREATE POLICY "Org users can view roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Org can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org(auth.uid())
    OR public.get_user_org(auth.uid()) IS NULL
  );

CREATE POLICY "Org admin can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'main_admin'));

-- user_permissions
DROP POLICY IF EXISTS "Authenticated users can view permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admin/sub_admin can insert permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admin/sub_admin can update permissions" ON public.user_permissions;

CREATE POLICY "Org users can view permissions" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Org admin can insert permissions" ON public.user_permissions
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org(auth.uid())
    AND (public.has_role(auth.uid(), 'main_admin') OR public.has_role(auth.uid(), 'sub_admin'))
  );

CREATE POLICY "Org admin can update permissions" ON public.user_permissions
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_org(auth.uid())
    AND (public.has_role(auth.uid(), 'main_admin') OR public.has_role(auth.uid(), 'sub_admin'))
  );

-- orders
DROP POLICY IF EXISTS "Authenticated users can view orders" ON public.orders;
DROP POLICY IF EXISTS "Authorized users can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Authorized users can update orders" ON public.orders;

CREATE POLICY "Org users can view orders" ON public.orders
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Org users can insert orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org(auth.uid())
    AND (
      public.has_role(auth.uid(), 'main_admin')
      OR public.has_role(auth.uid(), 'sub_admin')
      OR (public.has_role(auth.uid(), 'moderator') AND public.has_permission(auth.uid(), 'can_create_orders'))
    )
  );

CREATE POLICY "Org users can update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_org(auth.uid())
    AND (
      public.has_role(auth.uid(), 'main_admin')
      OR public.has_role(auth.uid(), 'sub_admin')
      OR (public.has_role(auth.uid(), 'moderator') AND public.has_permission(auth.uid(), 'can_create_orders'))
    )
  );

-- order_items
DROP POLICY IF EXISTS "Authenticated users can view order_items" ON public.order_items;
DROP POLICY IF EXISTS "Authorized users can insert order_items" ON public.order_items;

CREATE POLICY "Org users can view order_items" ON public.order_items
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Org users can insert order_items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org(auth.uid())
    AND (
      public.has_role(auth.uid(), 'main_admin')
      OR public.has_role(auth.uid(), 'sub_admin')
      OR (public.has_role(auth.uid(), 'moderator') AND public.has_permission(auth.uid(), 'can_create_orders'))
    )
  );

-- products
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
DROP POLICY IF EXISTS "Authorized users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authorized users can update products" ON public.products;

CREATE POLICY "Org users can view products" ON public.products
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Org users can insert products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org(auth.uid())
    AND (
      public.has_role(auth.uid(), 'main_admin')
      OR public.has_role(auth.uid(), 'sub_admin')
      OR (public.has_role(auth.uid(), 'moderator') AND public.has_permission(auth.uid(), 'can_edit_products'))
    )
  );

CREATE POLICY "Org users can update products" ON public.products
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_org(auth.uid())
    AND (
      public.has_role(auth.uid(), 'main_admin')
      OR public.has_role(auth.uid(), 'sub_admin')
      OR (public.has_role(auth.uid(), 'moderator') AND public.has_permission(auth.uid(), 'can_edit_products'))
    )
  );

-- customers
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authorized users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Authorized users can update customers" ON public.customers;

CREATE POLICY "Org users can view customers" ON public.customers
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Org users can insert customers" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org(auth.uid())
    AND (
      public.has_role(auth.uid(), 'main_admin')
      OR public.has_role(auth.uid(), 'sub_admin')
      OR (public.has_role(auth.uid(), 'moderator') AND public.has_permission(auth.uid(), 'can_delete_customers'))
    )
  );

CREATE POLICY "Org users can update customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_org(auth.uid())
    AND (
      public.has_role(auth.uid(), 'main_admin')
      OR public.has_role(auth.uid(), 'sub_admin')
      OR (public.has_role(auth.uid(), 'moderator') AND public.has_permission(auth.uid(), 'can_delete_customers'))
    )
  );

-- company_settings
DROP POLICY IF EXISTS "Admin/sub_admin can view company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Admin/sub_admin can insert company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Admin/sub_admin can update company_settings" ON public.company_settings;

CREATE POLICY "Org users can view company_settings" ON public.company_settings
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Org admin can insert company_settings" ON public.company_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org(auth.uid())
    AND (public.has_role(auth.uid(), 'main_admin') OR public.has_role(auth.uid(), 'sub_admin'))
  );

CREATE POLICY "Org admin can update company_settings" ON public.company_settings
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_org(auth.uid())
    AND (public.has_role(auth.uid(), 'main_admin') OR public.has_role(auth.uid(), 'sub_admin'))
  );

-- invoice_settings
DROP POLICY IF EXISTS "Authenticated users can view invoice_settings" ON public.invoice_settings;
DROP POLICY IF EXISTS "Admin/sub_admin can insert invoice_settings" ON public.invoice_settings;
DROP POLICY IF EXISTS "Admin/sub_admin can update invoice_settings" ON public.invoice_settings;

CREATE POLICY "Org users can view invoice_settings" ON public.invoice_settings
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Org admin can insert invoice_settings" ON public.invoice_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org(auth.uid())
    AND (public.has_role(auth.uid(), 'main_admin') OR public.has_role(auth.uid(), 'sub_admin'))
  );

CREATE POLICY "Org admin can update invoice_settings" ON public.invoice_settings
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_org(auth.uid())
    AND (public.has_role(auth.uid(), 'main_admin') OR public.has_role(auth.uid(), 'sub_admin'))
  );

-- invoice_settings_history
DROP POLICY IF EXISTS "Authenticated users can view invoice_settings_history" ON public.invoice_settings_history;
DROP POLICY IF EXISTS "Admin/sub_admin can insert invoice_settings_history" ON public.invoice_settings_history;
DROP POLICY IF EXISTS "Admin/sub_admin can delete invoice_settings_history" ON public.invoice_settings_history;

CREATE POLICY "Org users can view invoice_settings_history" ON public.invoice_settings_history
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Org admin can insert invoice_settings_history" ON public.invoice_settings_history
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org(auth.uid())
    AND (public.has_role(auth.uid(), 'main_admin') OR public.has_role(auth.uid(), 'sub_admin'))
  );

CREATE POLICY "Org admin can delete invoice_settings_history" ON public.invoice_settings_history
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_user_org(auth.uid())
    AND (public.has_role(auth.uid(), 'main_admin') OR public.has_role(auth.uid(), 'sub_admin'))
  );

-- couriers
DROP POLICY IF EXISTS "Authenticated users can view couriers" ON public.couriers;
DROP POLICY IF EXISTS "Admin/sub_admin can insert couriers" ON public.couriers;
DROP POLICY IF EXISTS "Admin/sub_admin can update couriers" ON public.couriers;
DROP POLICY IF EXISTS "Admin/sub_admin can delete couriers" ON public.couriers;

CREATE POLICY "Org users can view couriers" ON public.couriers
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Org admin can insert couriers" ON public.couriers
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org(auth.uid())
    AND (public.has_role(auth.uid(), 'main_admin') OR public.has_role(auth.uid(), 'sub_admin'))
  );

CREATE POLICY "Org admin can update couriers" ON public.couriers
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_org(auth.uid())
    AND (public.has_role(auth.uid(), 'main_admin') OR public.has_role(auth.uid(), 'sub_admin'))
  );

CREATE POLICY "Org admin can delete couriers" ON public.couriers
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_user_org(auth.uid())
    AND (public.has_role(auth.uid(), 'main_admin') OR public.has_role(auth.uid(), 'sub_admin'))
  );

-- invitations
DROP POLICY IF EXISTS "Admins can view invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can create invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can update invitations" ON public.invitations;
DROP POLICY IF EXISTS "Anyone can read invitation by token" ON public.invitations;

CREATE POLICY "Org admins can view invitations" ON public.invitations
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'main_admin'));

CREATE POLICY "Org admins can create invitations" ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_org(auth.uid())
    AND public.has_role(auth.uid(), 'main_admin')
  );

CREATE POLICY "Org admins can update invitations" ON public.invitations
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()) AND public.has_role(auth.uid(), 'main_admin'));

CREATE POLICY "Anon can read invitation by token" ON public.invitations
  FOR SELECT TO anon
  USING (true);

-- 7. Update handle_new_user to create org for first user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  _role app_role;
  _code TEXT;
  _user_count INTEGER;
  _org_id UUID;
BEGIN
  SELECT COUNT(*) INTO _user_count FROM public.users;
  
  IF _user_count = 0 THEN
    _role := 'main_admin';
  ELSE
    RETURN NEW;
  END IF;
  
  -- Create organization for main admin
  INSERT INTO public.organizations (name, created_by)
  VALUES ('My Organization', NEW.id)
  RETURNING id INTO _org_id;
  
  _code := public.generate_user_code(_role);
  
  INSERT INTO public.users (auth_id, user_code, email, name, phone, organization_id)
  VALUES (
    NEW.id,
    _code,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    _org_id
  );
  
  INSERT INTO public.user_roles (user_id, role, organization_id)
  VALUES (NEW.id, _role, _org_id);
  
  RETURN NEW;
END;
$function$;

-- 8. Update auto_create_user_permissions to include org_id
CREATE OR REPLACE FUNCTION public.auto_create_user_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.user_permissions (user_id, organization_id)
  VALUES (NEW.auth_id, NEW.organization_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 9. Update create_order_with_items to include org_id
CREATE OR REPLACE FUNCTION public.create_order_with_items(
  p_invoice_code text,
  p_customer_id uuid,
  p_created_by uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_advance numeric,
  p_cod numeric,
  p_note text,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
    order_value, advance, total_due, cod, note, organization_id)
  VALUES (p_invoice_code, p_customer_id, p_created_by,
    p_customer_name, p_customer_phone, p_customer_address,
    v_order_value, p_advance, v_order_value - p_advance, p_cod, p_note, v_org_id)
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

-- 10. Update save_invoice_settings_version to include org_id
CREATE OR REPLACE FUNCTION public.save_invoice_settings_version(p_settings_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_version INTEGER;
  v_settings RECORD;
  v_oldest_version INTEGER;
BEGIN
  SELECT * INTO v_settings FROM public.invoice_settings WHERE id = p_settings_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Settings not found';
  END IF;
  
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version
  FROM public.invoice_settings_history
  WHERE settings_id = p_settings_id;
  
  IF (SELECT COUNT(*) FROM public.invoice_settings_history WHERE settings_id = p_settings_id) >= 5 THEN
    SELECT MIN(version_number) INTO v_oldest_version
    FROM public.invoice_settings_history
    WHERE settings_id = p_settings_id;
    DELETE FROM public.invoice_settings_history
    WHERE settings_id = p_settings_id AND version_number = v_oldest_version;
  END IF;
  
  INSERT INTO public.invoice_settings_history (
    settings_id, version_number, use_background_image,
    primary_color, secondary_color, accent_color, text_color,
    header_color, border_color, background_color, organization_id
  ) VALUES (
    p_settings_id, v_version, v_settings.use_background_image,
    v_settings.primary_color, v_settings.secondary_color, v_settings.accent_color, v_settings.text_color,
    v_settings.header_color, v_settings.border_color, v_settings.background_color, v_settings.organization_id
  );
END;
$function$;

-- 11. Update singleton enforcers to be per-org
CREATE OR REPLACE FUNCTION public.enforce_single_company_settings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  IF (SELECT COUNT(*) FROM public.company_settings WHERE organization_id = NEW.organization_id) >= 1 THEN
    RAISE EXCEPTION 'Only one company settings record allowed per organization';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_single_invoice_settings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
BEGIN
  IF (SELECT COUNT(*) FROM public.invoice_settings WHERE organization_id = NEW.organization_id) >= 1 THEN
    RAISE EXCEPTION 'Only one invoice settings record allowed per organization';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_max_couriers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  courier_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO courier_count FROM public.couriers WHERE organization_id = NEW.organization_id;
  IF courier_count >= 3 THEN
    RAISE EXCEPTION 'Maximum 3 couriers allowed per organization';
  END IF;
  RETURN NEW;
END;
$function$;
