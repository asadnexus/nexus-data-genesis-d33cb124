
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS consignment_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_name text;
