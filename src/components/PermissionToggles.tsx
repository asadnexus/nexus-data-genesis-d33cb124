import { useUserPermissions, useUpdatePermission, type PermissionKey } from "@/hooks/usePermissions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface PermissionTogglesProps {
  userId: string;
  userRole: string;
}

interface PermissionItem {
  key: PermissionKey;
  label: string;
  group: string;
}

const PERMISSION_ITEMS: PermissionItem[] = [
  { key: "can_view_orders", label: "View orders", group: "Orders" },
  { key: "can_create_orders", label: "Create orders", group: "Orders" },
  { key: "can_delete_orders", label: "Delete orders", group: "Orders" },
  { key: "can_view_products", label: "View products", group: "Products" },
  { key: "can_edit_products", label: "Edit / delete products", group: "Products" },
  { key: "can_view_customers", label: "View customers", group: "Customers" },
  { key: "can_delete_customers", label: "Delete customers", group: "Customers" },
  { key: "can_view_dashboard", label: "View dashboard", group: "General" },
  { key: "can_view_settings", label: "View settings", group: "General" },
  { key: "can_print_invoice", label: "Print invoice", group: "General" },
  { key: "can_restore_deleted", label: "Restore deleted", group: "General" },
];

function getToggleableKeys(role: string): PermissionKey[] {
  if (role === "moderator") {
    return PERMISSION_ITEMS
      .filter((p) => p.key !== "can_restore_deleted")
      .map((p) => p.key);
  }
  return [];
}

export function PermissionToggles({ userId, userRole }: PermissionTogglesProps) {
  const { data: perms, isLoading } = useUserPermissions(userId);
  const updateMutation = useUpdatePermission();
  const { toast } = useToast();
  const toggleableKeys = getToggleableKeys(userRole);

  if (toggleableKeys.length === 0) return null;
  if (isLoading) {
    return <div className="py-2 text-sm text-muted-foreground">Loading permissions...</div>;
  }
  if (!perms) {
    return <div className="py-2 text-sm text-muted-foreground">No permissions record found</div>;
  }

  const items = PERMISSION_ITEMS.filter((p) => toggleableKeys.includes(p.key));

  const handleToggle = (key: PermissionKey, value: boolean) => {
    updateMutation.mutate(
      { userId, key, value },
      {
        onSuccess: () => toast({ title: "Permission updated" }),
        onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const groups = items.reduce<Record<string, PermissionItem[]>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="grid gap-4 py-2">
      {Object.entries(groups).map(([group, groupItems]) => (
        <div key={group}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group}</p>
          <div className="space-y-2">
            {groupItems.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <Label className="text-sm font-normal">{item.label}</Label>
                <Switch
                  checked={perms[item.key] as boolean}
                  onCheckedChange={(v) => handleToggle(item.key, v)}
                  disabled={updateMutation.isPending}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
