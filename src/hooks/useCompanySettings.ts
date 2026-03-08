import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompanySettings {
  id: string;
  name: string;
  logo_url: string;
  address: string;
  phone: string;
  email: string;
  website: string;
}

const defaultSettings: Omit<CompanySettings, "id"> = {
  name: "",
  logo_url: "",
  address: "",
  phone: "",
  email: "",
  website: "",
};

export function useCompanySettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as CompanySettings | null;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (settings: Omit<CompanySettings, "id"> & { id?: string }) => {
      if (settings.id) {
        const { error } = await supabase
          .from("company_settings")
          .update({
            name: settings.name,
            logo_url: settings.logo_url,
            address: settings.address,
            phone: settings.phone,
            email: settings.email,
            website: settings.website,
          })
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const { error } = await supabase.from("company_settings").insert({
          ...settings,
          created_by: user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-settings"] }),
  });

  const uploadLogo = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("company-assets").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("company-assets").getPublicUrl(path);
    return data.publicUrl;
  };

  return {
    settings: query.data ?? null,
    defaultSettings,
    isLoading: query.isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    uploadLogo,
  };
}
