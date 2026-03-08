
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('main_admin', 'sub_admin', 'moderator');

-- Create user_roles table (separate from users for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Users table (profile data)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_code TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users RLS: authenticated users can read all users, only main_admin can insert/update
CREATE POLICY "Authenticated users can view users"
  ON public.users FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Main admin can insert users"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'main_admin') OR NOT EXISTS (SELECT 1 FROM public.users));

CREATE POLICY "Main admin can update users"
  ON public.users FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'main_admin'));

-- User roles RLS
CREATE POLICY "Authenticated users can view roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Main admin can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'main_admin') OR NOT EXISTS (SELECT 1 FROM public.user_roles));

CREATE POLICY "Main admin can update roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'main_admin'));

-- Products table with soft delete
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/sub_admin can insert products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'main_admin') OR
    public.has_role(auth.uid(), 'sub_admin')
  );

CREATE POLICY "Admin/sub_admin can update products"
  ON public.products FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'main_admin') OR
    public.has_role(auth.uid(), 'sub_admin')
  );

-- Customers table with soft delete
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customers"
  ON public.customers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/sub_admin can insert customers"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'main_admin') OR
    public.has_role(auth.uid(), 'sub_admin')
  );

CREATE POLICY "Admin/sub_admin can update customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'main_admin') OR
    public.has_role(auth.uid(), 'sub_admin')
  );

-- Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate product code function
CREATE OR REPLACE FUNCTION public.generate_product_code()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'A' || LPAD((COALESCE(MAX(NULLIF(SUBSTRING(code FROM 2), '')::INTEGER), 0) + 1)::TEXT, 4, '0')
  FROM public.products
$$;

-- Auto-generate user code function
CREATE OR REPLACE FUNCTION public.generate_user_code(_role app_role)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE _role
    WHEN 'main_admin' THEN 'A' || LPAD((COALESCE(
      MAX(CASE WHEN user_code LIKE 'A%' AND user_code NOT LIKE 'A-%' THEN NULLIF(SUBSTRING(user_code FROM 2), '')::INTEGER END), 0) + 1)::TEXT, 3, '0')
    WHEN 'sub_admin' THEN 'SA-' || LPAD((COALESCE(
      MAX(CASE WHEN user_code LIKE 'SA-%' THEN NULLIF(SUBSTRING(user_code FROM 4), '')::INTEGER END), 0) + 1)::TEXT, 3, '0')
    WHEN 'moderator' THEN 'MOD-' || LPAD((COALESCE(
      MAX(CASE WHEN user_code LIKE 'MOD-%' THEN NULLIF(SUBSTRING(user_code FROM 5), '')::INTEGER END), 0) + 1)::TEXT, 3, '0')
  END
  FROM public.users
$$;

-- Trigger to auto-create user profile on signup (first user = main_admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _code TEXT;
  _user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO _user_count FROM public.users;
  
  IF _user_count = 0 THEN
    _role := 'main_admin';
  ELSE
    RETURN NEW;
  END IF;
  
  _code := public.generate_user_code(_role);
  
  INSERT INTO public.users (auth_id, user_code, email, name, phone)
  VALUES (
    NEW.id,
    _code,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'phone'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
