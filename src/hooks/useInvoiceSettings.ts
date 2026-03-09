import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InvoiceSettings {
  id: string;
  use_background_image: boolean;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  text_color: string;
  header_color: string;
  border_color: string;
  background_color: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceSettingsHistory {
  id: string;
  settings_id: string;
  version_number: number;
  use_background_image: boolean;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  text_color: string;
  header_color: string;
  border_color: string;
  background_color: string;
  created_at: string;
}

export const defaultInvoiceSettings: Omit<InvoiceSettings, "id" | "created_at" | "updated_at"> = {
  use_background_image: false,
  primary_color: "#3b6cf5",
  secondary_color: "#1a1a2e",
  accent_color: "#555555",
  text_color: "#1a1a2e",
  header_color: "#3b6cf5",
  border_color: "#dddddd",
  background_color: "#ffffff",
};

export function useInvoiceSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["invoice-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as InvoiceSettings | null;
    },
  });

  const historyQuery = useQuery({
    queryKey: ["invoice-settings-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_settings_history")
        .select("*")
        .order("version_number", { ascending: false });
      if (error) throw error;
      return data as InvoiceSettingsHistory[];
    },
    enabled: !!query.data?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (settings: Omit<InvoiceSettings, "id" | "created_at" | "updated_at"> & { id?: string }) => {
      // First, save current state to history if updating
      if (settings.id) {
        await supabase.rpc("save_invoice_settings_version", { p_settings_id: settings.id });

        const { error } = await supabase
          .from("invoice_settings")
          .update({
            use_background_image: settings.use_background_image,
            primary_color: settings.primary_color,
            secondary_color: settings.secondary_color,
            accent_color: settings.accent_color,
            text_color: settings.text_color,
            header_color: settings.header_color,
            border_color: settings.border_color,
            background_color: settings.background_color,
          })
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        
        const { error } = await supabase.from("invoice_settings").insert({
          ...settings,
          created_by: user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-settings"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-settings-history"] });
    },
  });

  const restoreVersionMutation = useMutation({
    mutationFn: async ({ settingsId, history }: { settingsId: string; history: InvoiceSettingsHistory }) => {
      // Save current state to history first
      await supabase.rpc("save_invoice_settings_version", { p_settings_id: settingsId });

      // Restore from history
      const { error } = await supabase
        .from("invoice_settings")
        .update({
          use_background_image: history.use_background_image,
          primary_color: history.primary_color,
          secondary_color: history.secondary_color,
          accent_color: history.accent_color,
          text_color: history.text_color,
          header_color: history.header_color,
          border_color: history.border_color,
          background_color: history.background_color,
        })
        .eq("id", settingsId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-settings"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-settings-history"] });
    },
  });

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading,
    history: historyQuery.data ?? [],
    historyLoading: historyQuery.isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    restoreVersion: restoreVersionMutation.mutateAsync,
    isRestoring: restoreVersionMutation.isPending,
  };
}
