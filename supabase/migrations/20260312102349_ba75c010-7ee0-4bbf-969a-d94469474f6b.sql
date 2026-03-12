CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role;
  _code TEXT;
  _org_id UUID;
  _invite_token TEXT;
  _org_name TEXT;
BEGIN
  _invite_token := NEW.raw_user_meta_data->>'invite_token';

  -- Invite signup is handled by accept-invite backend function
  IF _invite_token IS NOT NULL AND _invite_token <> '' THEN
    RETURN NEW;
  END IF;

  _role := 'main_admin';
  _org_name := NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), '');

  INSERT INTO public.organizations (name, created_by)
  VALUES (COALESCE(_org_name, 'My Organization'), NEW.id)
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP POLICY IF EXISTS "Org admins can create invitations" ON public.invitations;
CREATE POLICY "Org admins can create invitations"
ON public.invitations
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_user_org(auth.uid())
  AND public.has_role(auth.uid(), 'main_admin'::public.app_role)
  AND role IN ('sub_admin'::public.app_role, 'moderator'::public.app_role)
);

DROP POLICY IF EXISTS "Org admins can update invitations" ON public.invitations;
CREATE POLICY "Org admins can update invitations"
ON public.invitations
FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_user_org(auth.uid())
  AND public.has_role(auth.uid(), 'main_admin'::public.app_role)
)
WITH CHECK (
  organization_id = public.get_user_org(auth.uid())
  AND public.has_role(auth.uid(), 'main_admin'::public.app_role)
  AND role IN ('sub_admin'::public.app_role, 'moderator'::public.app_role)
);

ALTER TABLE public.invitations
DROP CONSTRAINT IF EXISTS invitations_role_not_main_admin;

ALTER TABLE public.invitations
ADD CONSTRAINT invitations_role_not_main_admin
CHECK (role IN ('sub_admin'::public.app_role, 'moderator'::public.app_role)) NOT VALID;