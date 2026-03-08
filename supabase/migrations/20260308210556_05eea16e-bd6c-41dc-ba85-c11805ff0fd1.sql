
-- Create couriers table (max 3 enforced via trigger)
CREATE TABLE public.couriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_key TEXT NOT NULL DEFAULT '',
  secret_key TEXT NOT NULL DEFAULT '',
  base_url TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view couriers"
  ON public.couriers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin/sub_admin can insert couriers"
  ON public.couriers FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'main_admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Admin/sub_admin can update couriers"
  ON public.couriers FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'main_admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Admin/sub_admin can delete couriers"
  ON public.couriers FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'main_admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

-- Trigger to enforce max 3 couriers
CREATE OR REPLACE FUNCTION public.enforce_max_couriers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  courier_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO courier_count FROM public.couriers;
  IF courier_count >= 3 THEN
    RAISE EXCEPTION 'Maximum 3 couriers allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_max_couriers
  BEFORE INSERT ON public.couriers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_couriers();

-- Update updated_at trigger
CREATE TRIGGER update_couriers_updated_at
  BEFORE UPDATE ON public.couriers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add courier_id to orders table
ALTER TABLE public.orders ADD COLUMN courier_id UUID REFERENCES public.couriers(id);
