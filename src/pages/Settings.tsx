import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Eye, EyeOff, Truck, Settings as SettingsIcon, Building2, Upload, Globe, Mail, Phone, MapPin } from "lucide-react";
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
import { useCompanySettings } from "@/hooks/useCompanySettings";

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
        const { data: orgData } = await supabase.from("users").select("organization_id").eq("auth_id", user.id).single();

        const { error } = await supabase.from("couriers").insert({
          name: name.trim(),
          api_key: apiKey.trim(),
          secret_key: secretKey.trim(),
          base_url: baseUrl.trim(),
          is_active: isActive,
          created_by: user.id,
          organization_id: orgData?.organization_id,
        } as any);
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

  // ── Company Settings ──
  const { settings: companySettings, save: saveCompany, isSaving: isSavingCompany, uploadLogo } = useCompanySettings();
  const [compName, setCompName] = useState("");
  const [compAddress, setCompAddress] = useState("");
  const [compPhone, setCompPhone] = useState("");
  const [compEmail, setCompEmail] = useState("");
  const [compWebsite, setCompWebsite] = useState("");
  const [compLogoUrl, setCompLogoUrl] = useState("");
  const [companyInitialized, setCompanyInitialized] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Sync form state when settings load
  if (companySettings && !companyInitialized) {
    setCompName(companySettings.name);
    setCompAddress(companySettings.address);
    setCompPhone(companySettings.phone);
    setCompEmail(companySettings.email);
    setCompWebsite(companySettings.website);
    setCompLogoUrl(companySettings.logo_url);
    setCompanyInitialized(true);
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadLogo(file);
      setCompLogoUrl(url);
      toast({ title: "Logo uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveCompany({
        id: companySettings?.id,
        name: compName.trim(),
        logo_url: compLogoUrl,
        address: compAddress.trim(),
        phone: compPhone.trim(),
        email: compEmail.trim(),
        website: compWebsite.trim(),
      });
      toast({ title: "Company settings saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="max-w-[1920px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-nexus-text-primary flex items-center gap-2">
          <SettingsIcon className="h-6 w-6" /> Settings
        </h1>
        <p className="text-nexus-text-secondary">Manage company details and courier integrations</p>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="bg-nexus-background border border-nexus-border">
          <TabsTrigger value="company" className="gap-2 data-[state=active]:bg-nexus-accent data-[state=active]:text-white"><Building2 className="h-4 w-4" /> Company</TabsTrigger>
          <TabsTrigger value="couriers" className="gap-2 data-[state=active]:bg-nexus-accent data-[state=active]:text-white"><Truck className="h-4 w-4" /> Couriers</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <div className="bg-nexus-card rounded-2xl border border-nexus-border hover:shadow-lg transition-shadow">
            <div className="p-5 sm:p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-nexus-text-primary flex items-center gap-2"><Building2 className="h-5 w-5" /> Company Information</h2>
                <p className="text-sm text-nexus-text-secondary">This information will appear on your invoices</p>
              </div>
              <form onSubmit={handleSaveCompany} className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-lg border border-nexus-border bg-nexus-background flex items-center justify-center overflow-hidden">
                    {compLogoUrl ? (
                      <img src={compLogoUrl} alt="Logo" className="h-full w-full object-contain" />
                    ) : (
                      <Building2 className="h-8 w-8 text-nexus-text-secondary" />
                    )}
                  </div>
                  <div>
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="border-nexus-border hover:bg-nexus-background text-nexus-text-secondary">
                      <Upload className="mr-2 h-4 w-4" />
                      {uploadingLogo ? "Uploading..." : "Upload Logo"}
                    </Button>
                    <p className="text-xs text-nexus-text-secondary mt-1">PNG, JPG up to 2MB</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1 text-nexus-text-primary"><Building2 className="h-3 w-3" /> Company Name</Label>
                    <Input value={compName} onChange={(e) => setCompName(e.target.value)} placeholder="Your Company" className="bg-nexus-background border-nexus-border text-nexus-text-primary" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1 text-nexus-text-primary"><Phone className="h-3 w-3" /> Phone</Label>
                    <Input value={compPhone} onChange={(e) => setCompPhone(e.target.value)} placeholder="+880..." className="bg-nexus-background border-nexus-border text-nexus-text-primary" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1 text-nexus-text-primary"><Mail className="h-3 w-3" /> Email</Label>
                    <Input value={compEmail} onChange={(e) => setCompEmail(e.target.value)} placeholder="info@company.com" className="bg-nexus-background border-nexus-border text-nexus-text-primary" />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1 text-nexus-text-primary"><Globe className="h-3 w-3" /> Website</Label>
                    <Input value={compWebsite} onChange={(e) => setCompWebsite(e.target.value)} placeholder="www.company.com" className="bg-nexus-background border-nexus-border text-nexus-text-primary" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1 text-nexus-text-primary"><MapPin className="h-3 w-3" /> Address</Label>
                  <Textarea value={compAddress} onChange={(e) => setCompAddress(e.target.value)} placeholder="Full business address" className="bg-nexus-background border-nexus-border text-nexus-text-primary" rows={2} />
                </div>
                <Button type="submit" className="bg-nexus-accent text-white shadow-lg shadow-nexus-accent/25 hover:bg-nexus-accent/90" disabled={isSavingCompany}>
                  {isSavingCompany ? "Saving..." : "Save Company Settings"}
                </Button>
              </form>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="couriers">
          <div className="bg-nexus-card rounded-2xl border border-nexus-border hover:shadow-lg transition-shadow">
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-nexus-text-primary flex items-center gap-2"><Truck className="h-5 w-5" /> Courier Services</h2>
                  <p className="text-sm text-nexus-text-secondary">{couriers.length}/3 slots used — Configure courier API credentials for dispatch</p>
                </div>
                {canEdit && couriers.length < 3 && (
                  <Button onClick={openCreate} className="bg-nexus-accent text-white shadow-lg shadow-nexus-accent/25 hover:bg-nexus-accent/90">
                    <Plus className="mr-2 h-4 w-4" /> Add Courier
                  </Button>
                )}
              </div>
              {isLoading ? (
                <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-nexus-accent border-t-transparent" /></div>
              ) : couriers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-nexus-text-secondary">
                  <Truck className="mb-4 h-12 w-12" /><p>No couriers configured</p><p className="text-sm">Add up to 3 courier services</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {couriers.map((courier) => {
                    const vis = visibleKeys[courier.id] || { api: false, secret: false };
                    return (
                      <div key={courier.id} className="rounded-xl border border-nexus-border bg-nexus-background p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-nexus-accent/10 flex items-center justify-center">
                              <Truck className="h-5 w-5 text-nexus-accent" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-nexus-text-primary">{courier.name}</h3>
                              <p className="text-xs text-nexus-text-secondary">
                                {courier.name.toLowerCase().includes("steadfast") ? "Base URL: https://portal.packzy.com/api/v1" : courier.base_url || "No base URL set"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {canEdit ? (
                              <Select value={courier.is_active ? "active" : "inactive"} onValueChange={(val) => toggleStatusMutation.mutate({ id: courier.id, active: val === "active" })}>
                                <SelectTrigger className={cn("w-[110px] h-8 text-xs font-medium border", courier.is_active ? "bg-nexus-success/10 text-nexus-success border-nexus-success/30" : "bg-nexus-background text-nexus-text-secondary border-nexus-border")}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                              </Select>
                            ) : (
                              <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border", courier.is_active ? "bg-nexus-success/10 text-nexus-success border-nexus-success/30" : "bg-nexus-background text-nexus-text-secondary border-nexus-border")}>
                                {courier.is_active ? "Active" : "Inactive"}
                              </span>
                            )}
                            {canEdit && (
                              <>
                                <Button size="icon" variant="ghost" onClick={() => openEdit(courier)} title="Edit" className="hover:bg-nexus-background"><Pencil className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => setDeleteId(courier.id)} className="text-nexus-danger hover:text-nexus-danger hover:bg-nexus-danger/10" title="Delete"><Trash2 className="h-4 w-4" /></Button>
                              </>
                            )}
                          </div>
                        </div>
                        <Separator className="bg-nexus-border" />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <span className="text-xs font-medium text-nexus-text-secondary">API Key</span>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 rounded bg-nexus-background px-2 py-1 text-xs font-mono text-nexus-text-primary border border-nexus-border">{vis.api ? courier.api_key || "—" : maskKey(courier.api_key)}</code>
                              <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-nexus-background" onClick={() => toggleVisibility(courier.id, "api")}>{vis.api ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</Button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs font-medium text-nexus-text-secondary">Secret Key</span>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 rounded bg-nexus-background px-2 py-1 text-xs font-mono text-nexus-text-primary border border-nexus-border">{vis.secret ? courier.secret_key || "—" : maskKey(courier.secret_key)}</code>
                              <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-nexus-background" onClick={() => toggleVisibility(courier.id, "secret")}>{vis.secret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-nexus-card border-nexus-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-nexus-text-primary">{editingCourier ? `Edit — ${editingCourier.name}` : "Add Courier"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label className="text-nexus-text-primary">Courier Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Steadfast, Pathao, RedX" required className="bg-nexus-background border-nexus-border text-nexus-text-primary" /></div>
            <div className="space-y-2"><Label className="text-nexus-text-primary">API Key</Label><Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Enter API key" className="bg-nexus-background border-nexus-border font-mono text-sm text-nexus-text-primary" /></div>
            <div className="space-y-2"><Label className="text-nexus-text-primary">Secret Key</Label><Input value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder="Enter secret key" className="bg-nexus-background border-nexus-border font-mono text-sm text-nexus-text-primary" /></div>
            <div className="space-y-2"><Label className="text-nexus-text-primary">Base URL</Label><Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.courier.com/v1" className="bg-nexus-background border-nexus-border font-mono text-sm text-nexus-text-primary" /></div>
            <div className="flex items-center justify-between"><Label className="text-nexus-text-primary">Active</Label><Switch checked={isActive} onCheckedChange={setIsActive} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-nexus-border hover:bg-nexus-background text-nexus-text-secondary">Cancel</Button>
              <Button type="submit" className="bg-nexus-accent text-white shadow-lg shadow-nexus-accent/25 hover:bg-nexus-accent/90" disabled={saveMutation.isPending}>{editingCourier ? "Save Changes" : "Add Courier"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-nexus-card border-nexus-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-nexus-text-primary">Delete Courier?</AlertDialogTitle>
            <AlertDialogDescription className="text-nexus-text-secondary">This will permanently remove this courier configuration. Orders using this courier will not be affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-nexus-border hover:bg-nexus-background">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-nexus-danger text-white hover:bg-nexus-danger/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
