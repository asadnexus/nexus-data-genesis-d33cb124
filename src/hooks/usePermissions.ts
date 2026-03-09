import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

type UserPermissions = Tables<"user_permissions">;

export type PermissionKey = 
  | "can_view_orders" | "can_create_orders" | "can_delete_orders"
  | "can_view_products" | "can_edit_products"
  | "can_view_customers" | "can_delete_customers"
  | "can_view_dashboard" | "can_view_settings"
  | "can_print_invoice" | "can_view_activity_logs"
  | "can_restore_deleted";

const ALL_TRUE: Record<PermissionKey, boolean> = {
  can_view_orders: true,
  can_create_orders: true,
  can_delete_orders: true,
  can_view_products: true,
  can_edit_products: true,
  can_view_customers: true,
  can_delete_customers: true,
  can_view_dashboard: true,
  can_view_settings: true,
  can_print_invoice: true,
  can_view_activity_logs: true,
  can_restore_deleted: true,
};

// Sub-admin always has everything EXCEPT activity_logs is toggleable
const SUB_ADMIN_ALWAYS: Partial<Record<PermissionKey, boolean>> = {
  can_view_orders: true,
  can_create_orders: true,
  can_delete_orders: true,
  can_view_products: true,
  can_edit_products: true,
  can_view_customers: true,
  can_delete_customers: true,
  can_view_dashboard: true,
  can_view_settings: true,
  can_print_invoice: true,
  can_restore_deleted: true,
};

// Moderator: restore_deleted is always true, everything else is toggleable
const MODERATOR_ALWAYS: Partial<Record<PermissionKey, boolean>> = {
  can_restore_deleted: true,
};

function resolvePermissions(
  role: string | null,
  dbPerms: UserPermissions | null
): Record<PermissionKey, boolean> {
  if (role === "main_admin") return { ...ALL_TRUE };

  if (role === "sub_admin") {
    return {
      ...ALL_TRUE,
      ...SUB_ADMIN_ALWAYS,
      // activity_logs is toggleable for sub_admin
      can_view_activity_logs: dbPerms?.can_view_activity_logs ?? false,
    };
  }

  if (role === "moderator") {
    if (!dbPerms) {
      return {
        ...ALL_TRUE,
        can_view_activity_logs: false,
        can_view_settings: false,
        can_edit_products: false,
        can_delete_orders: false,
        can_delete_customers: false,
      };
    }
    return {
      can_view_orders: dbPerms.can_view_orders,
      can_create_orders: dbPerms.can_create_orders,
      can_delete_orders: dbPerms.can_delete_orders,
      can_view_products: dbPerms.can_view_products,
      can_edit_products: dbPerms.can_edit_products,
      can_view_customers: dbPerms.can_view_customers,
      can_delete_customers: dbPerms.can_delete_customers,
      can_view_dashboard: dbPerms.can_view_dashboard,
      can_view_settings: dbPerms.can_view_settings,
      can_print_invoice: dbPerms.can_print_invoice,
      can_view_activity_logs: dbPerms.can_view_activity_logs,
      // Always true for moderator
      can_restore_deleted: true,
    };
  }

  // Fallback: no access
  return Object.fromEntries(
    Object.keys(ALL_TRUE).map((k) => [k, false])
  ) as Record<PermissionKey, boolean>;
}

/** Fetch and resolve effective permissions for the currently logged-in user */
export function useMyPermissions() {
  const { user, role } = useAuth();

  const { data: dbPerms, isLoading } = useQuery({
    queryKey: ["my-permissions", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  return {
    permissions: resolvePermissions(role, dbPerms),
    isLoading,
  };
}

/** Fetch permissions for a specific user (for admin toggle UI) */
export function useUserPermissions(userId: string | null) {
  return useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", userId)
        .single();
      return data;
    },
    enabled: !!userId,
  });
}

/** Update a single permission for a user */
export function useUpdatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      key,
      value,
    }: {
      userId: string;
      key: PermissionKey;
      value: boolean;
    }) => {
      const { error } = await supabase
        .from("user_permissions")
        .update({ [key]: value, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions", vars.userId] });
      queryClient.invalidateQueries({ queryKey: ["my-permissions"] });
    },
  });
}
