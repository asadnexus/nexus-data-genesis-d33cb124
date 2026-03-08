import { useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Eye, EyeOff, Truck, Settings as SettingsIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Courier {
  id: string;
  name: string;
  api_key: string;
  secret_key: string;
  base_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function maskKey(key: string): string {
  if (!key || key.length <= 6) return "••••••••";
  return key.slice(0, 3) + "••••••••" + key.slice(-3);
}

export default function Settings() {
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canEdit = role === "main_admin" || role === "sub_admin";

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Visibility toggles
  const [visibleKeys, setVisibleKeys] = useState<Record<string, { api: boolean; secret: boolean }>>({});

  const toggleVisibility = (courierId: string, field: "api" | "secret") => {
    setVisibleKeys((prev) => ({
      ...prev,
      [courierId]: {
        ...prev[courierId],
        [field]: !prev[courierId]?.[field],
      },
    }));
  };

  // Fetch couriers
  const { data: couriers = [], isLoading } = useQuery({
    queryKey: ["couriers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("couriers")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Courier[];
    },
  });

  const openCreate = () => {
    setEditingCourier(null);
    setName("");
    setApiKey("");
    setSecretKey("");
    setBaseUrl("");
    setIsActive(true);
    setDialogOpen(true);
  };

  const openEdit = (courier: Courier) => {
    setEditingCourier(courier);
    setName(courier.name);
    setApiKey(courier.api_key);
    setSecretKey(courier.secret_key);
    setBaseUrl(courier.base_url);
    setIsActive(courier.is_active);
    setDialogOpen(true);
  };

  // Save mutation (create or update)
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Courier name is required");

      if (editingCourier) {
        const { error } = await supabase
          .from("couriers")
          .update({
            name: name.trim(),
            api_key: apiKey.trim(),
            secret_key: secretKey.trim(),
            base_url: baseUrl.trim(),
            is_active: isActive,
          })
          .eq("id", editingCourier.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { error } = await supabase.from("couriers").insert({
          name: name.trim(),
          api_key: apiKey.trim(),
          secret_key: secretKey.trim(),
          base_url: baseUrl.trim(),
          is_active: isActive,
          created_by: user.id,
        });
        if (error) {
          if (error.message.includes("Maximum 3 couriers")) {
            throw new Error("Maximum 3 couriers allowed. Delete one to add another.");
          }
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["couriers"] });
      toast({ title: editingCourier ? "Courier updated" : "Courier added" });
      setDialogOpen(false);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("couriers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["couriers"] });
      toast({ title: "Courier deleted" });
      setDeleteId(null);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("couriers").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["couriers"] });
      toast({ title: "Courier status updated" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="h-6 w-6" /> Settings
        </h1>
        <p className="text-muted-foreground">Manage courier integrations and system settings</p>
      </div>

      {/* Courier Settings */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-card-foreground">
                <Truck className="h-5 w-5" /> Courier Services
              </CardTitle>
              <CardDescription>
                {couriers.length}/3 slots used — Configure courier API credentials for dispatch
              </CardDescription>
            </div>
            {canEdit && couriers.length < 3 && (
              <Button onClick={openCreate} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                <Plus className="mr-2 h-4 w-4" /> Add Courier
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-transparent" />
            </div>
          ) : couriers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Truck className="mb-4 h-12 w-12" />
              <p>No couriers configured</p>
              <p className="text-sm">Add up to 3 courier services</p>
            </div>
          ) : (
            <div className="space-y-4">
              {couriers.map((courier) => {
                const vis = visibleKeys[courier.id] || { api: false, secret: false };
                return (
                  <div
                    key={courier.id}
                    className="rounded-lg border border-border bg-background p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                          <Truck className="h-5 w-5 text-secondary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{courier.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {courier.base_url || "No base URL set"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canEdit ? (
                          <Select
                            value={courier.is_active ? "active" : "inactive"}
                            onValueChange={(val) => toggleStatusMutation.mutate({ id: courier.id, active: val === "active" })}
                          >
                            <SelectTrigger className={cn(
                              "w-[110px] h-8 text-xs font-medium border",
                              courier.is_active
                                ? "bg-green-500/20 text-green-400 border-green-500/30"
                                : "bg-muted text-muted-foreground border-border"
                            )}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border",
                            courier.is_active
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : "bg-muted text-muted-foreground border-border"
                          )}>
                            {courier.is_active ? "Active" : "Inactive"}
                          </span>
                        )}
                        {canEdit && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => openEdit(courier)} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteId(courier.id)}
                              className="text-destructive hover:text-destructive"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* API Key */}
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">API Key</span>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 rounded bg-muted/50 px-2 py-1 text-xs font-mono text-foreground">
                            {vis.api ? courier.api_key || "—" : maskKey(courier.api_key)}
                          </code>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => toggleVisibility(courier.id, "api")}
                          >
                            {vis.api ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>

                      {/* Secret Key */}
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Secret Key</span>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 rounded bg-muted/50 px-2 py-1 text-xs font-mono text-foreground">
                            {vis.secret ? courier.secret_key || "—" : maskKey(courier.secret_key)}
                          </code>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => toggleVisibility(courier.id, "secret")}
                          >
                            {vis.secret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Courier Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-background border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingCourier ? `Edit — ${editingCourier.name}` : "Add Courier"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Courier Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Steadfast, Pathao, RedX"
                required
                className="bg-background/50 border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API key"
                className="bg-background/50 border-border font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Secret Key</Label>
              <Input
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="Enter secret key"
                className="bg-background/50 border-border font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.courier.com/v1"
                className="bg-background/50 border-border font-mono text-sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                disabled={saveMutation.isPending}
              >
                {editingCourier ? "Save Changes" : "Add Courier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Courier?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this courier configuration. Orders using this courier will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
