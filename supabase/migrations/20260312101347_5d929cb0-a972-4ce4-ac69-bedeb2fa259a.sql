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
BEGIN
  _invite_token := NEW.raw_user_meta_data->>'invite_token';
  
  IF _invite_token IS NOT NULL AND _invite_token != '' THEN
    RETURN NEW;
  END IF;
  
  _role := 'main_admin';
  
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