
-- Fix permissive INSERT policy on organizations
DROP POLICY IF EXISTS "Authenticated can insert org" ON public.organizations;

CREATE POLICY "Main admin can insert org" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'main_admin') OR NOT EXISTS (SELECT 1 FROM public.organizations));
