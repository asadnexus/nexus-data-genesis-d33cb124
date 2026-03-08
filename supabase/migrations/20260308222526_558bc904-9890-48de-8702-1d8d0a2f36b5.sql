
-- Company settings table (singleton per user/org)
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  logo_url text DEFAULT '',
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  website text DEFAULT '',
  created_by uuid NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Only admin/sub_admin can manage company settings
CREATE POLICY "Admin/sub_admin can view company_settings"
  ON public.company_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/sub_admin can insert company_settings"
  ON public.company_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'main_admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Admin/sub_admin can update company_settings"
  ON public.company_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'main_admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

-- Enforce singleton (max 1 row)
CREATE OR REPLACE FUNCTION public.enforce_single_company_settings()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.company_settings) >= 1 THEN
    RAISE EXCEPTION 'Only one company settings record allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_single_company_settings
  BEFORE INSERT ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_company_settings();

-- Storage bucket for company logos
INSERT INTO storage.buckets (id, name, public) VALUES ('company-assets', 'company-assets', true);

-- Allow authenticated users to upload/read company assets
CREATE POLICY "Authenticated users can upload company assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-assets');

CREATE POLICY "Public can read company assets"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'company-assets');

CREATE POLICY "Authenticated users can update company assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-assets');
