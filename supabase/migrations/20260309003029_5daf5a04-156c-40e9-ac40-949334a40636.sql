-- Create invoice_settings table for storing customization
CREATE TABLE public.invoice_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  
  -- Background settings
  use_background_image BOOLEAN NOT NULL DEFAULT false,
  
  -- Color settings (7 theme colors)
  primary_color TEXT NOT NULL DEFAULT '#3b6cf5',
  secondary_color TEXT NOT NULL DEFAULT '#1a1a2e',
  accent_color TEXT NOT NULL DEFAULT '#555555',
  text_color TEXT NOT NULL DEFAULT '#1a1a2e',
  header_color TEXT NOT NULL DEFAULT '#3b6cf5',
  border_color TEXT NOT NULL DEFAULT '#ddd',
  background_color TEXT NOT NULL DEFAULT '#ffffff',
  
  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoice_settings_history table for version history (max 5)
CREATE TABLE public.invoice_settings_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  settings_id UUID REFERENCES public.invoice_settings(id) ON DELETE CASCADE NOT NULL,
  version_number INTEGER NOT NULL,
  
  -- Snapshot of settings
  use_background_image BOOLEAN NOT NULL,
  primary_color TEXT NOT NULL,
  secondary_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  text_color TEXT NOT NULL,
  header_color TEXT NOT NULL,
  border_color TEXT NOT NULL,
  background_color TEXT NOT NULL,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(settings_id, version_number)
);

-- Enable RLS
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_settings_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoice_settings
CREATE POLICY "Authenticated users can view invoice_settings"
ON public.invoice_settings
FOR SELECT
USING (true);

CREATE POLICY "Admin/sub_admin can insert invoice_settings"
ON public.invoice_settings
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'main_admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Admin/sub_admin can update invoice_settings"
ON public.invoice_settings
FOR UPDATE
USING (has_role(auth.uid(), 'main_admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

-- RLS Policies for invoice_settings_history
CREATE POLICY "Authenticated users can view invoice_settings_history"
ON public.invoice_settings_history
FOR SELECT
USING (true);

CREATE POLICY "Admin/sub_admin can insert invoice_settings_history"
ON public.invoice_settings_history
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'main_admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

CREATE POLICY "Admin/sub_admin can delete invoice_settings_history"
ON public.invoice_settings_history
FOR DELETE
USING (has_role(auth.uid(), 'main_admin'::app_role) OR has_role(auth.uid(), 'sub_admin'::app_role));

-- Trigger to update updated_at
CREATE TRIGGER update_invoice_settings_updated_at
BEFORE UPDATE ON public.invoice_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enforce single settings record
CREATE OR REPLACE FUNCTION public.enforce_single_invoice_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.invoice_settings) >= 1 THEN
    RAISE EXCEPTION 'Only one invoice settings record allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER enforce_single_invoice_settings_trigger
BEFORE INSERT ON public.invoice_settings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_invoice_settings();

-- Function to save version history (max 5)
CREATE OR REPLACE FUNCTION public.save_invoice_settings_version(p_settings_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version INTEGER;
  v_settings RECORD;
  v_oldest_version INTEGER;
BEGIN
  -- Get current settings
  SELECT * INTO v_settings FROM public.invoice_settings WHERE id = p_settings_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Settings not found';
  END IF;
  
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version
  FROM public.invoice_settings_history
  WHERE settings_id = p_settings_id;
  
  -- Delete oldest if we have 5 versions
  IF (SELECT COUNT(*) FROM public.invoice_settings_history WHERE settings_id = p_settings_id) >= 5 THEN
    SELECT MIN(version_number) INTO v_oldest_version
    FROM public.invoice_settings_history
    WHERE settings_id = p_settings_id;
    
    DELETE FROM public.invoice_settings_history
    WHERE settings_id = p_settings_id AND version_number = v_oldest_version;
  END IF;
  
  -- Insert new version
  INSERT INTO public.invoice_settings_history (
    settings_id, version_number, use_background_image,
    primary_color, secondary_color, accent_color, text_color,
    header_color, border_color, background_color
  ) VALUES (
    p_settings_id, v_version, v_settings.use_background_image,
    v_settings.primary_color, v_settings.secondary_color, v_settings.accent_color, v_settings.text_color,
    v_settings.header_color, v_settings.border_color, v_settings.background_color
  );
END;
$$;