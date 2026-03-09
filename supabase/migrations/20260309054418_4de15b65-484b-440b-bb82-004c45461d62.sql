
-- Drop activity_logs table
DROP TABLE IF EXISTS public.activity_logs CASCADE;

-- Create invitations table
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  role public.app_role NOT NULL,
  created_by uuid NOT NULL,
  used_by uuid,
  used_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admins can view all invitations
CREATE POLICY "Admins can view invitations"
  ON public.invitations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'main_admin'::app_role));

-- Admins can create invitations
CREATE POLICY "Admins can create invitations"
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'main_admin'::app_role));

-- Admins can update invitations (for marking as used)
CREATE POLICY "Admins can update invitations"
  ON public.invitations FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'main_admin'::app_role));

-- Anyone can read invitations by token (for signup validation) - using anon
CREATE POLICY "Anyone can read invitation by token"
  ON public.invitations FOR SELECT TO anon
  USING (true);
