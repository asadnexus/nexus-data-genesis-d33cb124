-- Create function to check user permissions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT 
      CASE _permission
        WHEN 'can_view_orders' THEN can_view_orders
        WHEN 'can_create_orders' THEN can_create_orders
        WHEN 'can_delete_orders' THEN can_delete_orders
        WHEN 'can_view_products' THEN can_view_products
        WHEN 'can_edit_products' THEN can_edit_products
        WHEN 'can_view_customers' THEN can_view_customers
        WHEN 'can_delete_customers' THEN can_delete_customers
        WHEN 'can_view_dashboard' THEN can_view_dashboard
        WHEN 'can_view_settings' THEN can_view_settings
        WHEN 'can_print_invoice' THEN can_print_invoice
        WHEN 'can_view_activity_logs' THEN can_view_activity_logs
        WHEN 'can_restore_deleted' THEN can_restore_deleted
        ELSE false
      END
    FROM public.user_permissions
    WHERE user_id = _user_id),
    false
  )
$$;

-- Drop existing moderator-restrictive policies and update to include permission checks

-- ORDERS: Allow moderators with permission to insert
DROP POLICY IF EXISTS "Admin/sub_admin can insert orders" ON public.orders;
CREATE POLICY "Authorized users can insert orders" ON public.orders
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'main_admin') OR
  has_role(auth.uid(), 'sub_admin') OR
  (has_role(auth.uid(), 'moderator') AND has_permission(auth.uid(), 'can_create_orders'))
);

-- ORDERS: Allow moderators with permission to update
DROP POLICY IF EXISTS "Admin/sub_admin can update orders" ON public.orders;
CREATE POLICY "Authorized users can update orders" ON public.orders
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'main_admin') OR
  has_role(auth.uid(), 'sub_admin') OR
  (has_role(auth.uid(), 'moderator') AND has_permission(auth.uid(), 'can_create_orders'))
);

-- ORDER_ITEMS: Allow moderators with permission to insert
DROP POLICY IF EXISTS "Admin/sub_admin can insert order_items" ON public.order_items;
CREATE POLICY "Authorized users can insert order_items" ON public.order_items
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'main_admin') OR
  has_role(auth.uid(), 'sub_admin') OR
  (has_role(auth.uid(), 'moderator') AND has_permission(auth.uid(), 'can_create_orders'))
);

-- PRODUCTS: Allow moderators with permission to insert
DROP POLICY IF EXISTS "Admin/sub_admin can insert products" ON public.products;
CREATE POLICY "Authorized users can insert products" ON public.products
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'main_admin') OR
  has_role(auth.uid(), 'sub_admin') OR
  (has_role(auth.uid(), 'moderator') AND has_permission(auth.uid(), 'can_edit_products'))
);

-- PRODUCTS: Allow moderators with permission to update
DROP POLICY IF EXISTS "Admin/sub_admin can update products" ON public.products;
CREATE POLICY "Authorized users can update products" ON public.products
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'main_admin') OR
  has_role(auth.uid(), 'sub_admin') OR
  (has_role(auth.uid(), 'moderator') AND has_permission(auth.uid(), 'can_edit_products'))
);

-- CUSTOMERS: Allow moderators with permission to insert
DROP POLICY IF EXISTS "Admin/sub_admin can insert customers" ON public.customers;
CREATE POLICY "Authorized users can insert customers" ON public.customers
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'main_admin') OR
  has_role(auth.uid(), 'sub_admin') OR
  (has_role(auth.uid(), 'moderator') AND has_permission(auth.uid(), 'can_delete_customers'))
);

-- CUSTOMERS: Allow moderators with permission to update
DROP POLICY IF EXISTS "Admin/sub_admin can update customers" ON public.customers;
CREATE POLICY "Authorized users can update customers" ON public.customers
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'main_admin') OR
  has_role(auth.uid(), 'sub_admin') OR
  (has_role(auth.uid(), 'moderator') AND has_permission(auth.uid(), 'can_delete_customers'))
);