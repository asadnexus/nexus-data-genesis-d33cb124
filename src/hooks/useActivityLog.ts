import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";

export function useActivityLog() {
  const { user, profile } = useAuth();

  const log = useCallback(
    async (
      action: string,
      entityType: string,
      entityId?: string,
      details?: Record<string, unknown>
    ) => {
      if (!user || !profile) return;
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        user_name: profile.name,
        user_code: profile.user_code,
        action,
        entity_type: entityType,
        entity_id: entityId ?? null,
        details: details ?? {},
      } as any);
    },
    [user, profile]
  );

  return { log };
}
