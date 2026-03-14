import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyPermissions } from "@/hooks/usePermissions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, RotateCcw, Users, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;

export default function Customers() {
  const { user } = useAuth();
  const { permissions } = useMyPermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const canView = permissions.can_view_customers;
  const canDelete = permissions.can_delete_customers;
  const canRestore = permissions.can_restore_deleted;

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", showDeleted],
    queryFn: async () => {
      let query = supabase.from("customers").select("*").order("created_at", { ascending: false });
      if (!showDeleted) query = query.is("deleted_at", null);
      const { data, error } = await query;
      if (error) throw error;
      return data as Customer[];
    },
    enabled: canView,
  });

  const processedCustomers = useMemo(() => {
    const sorted = [...customers].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const withSerial = sorted.map((c, i) => ({ ...c, serial: i + 1 }));
    const filtered = withSerial.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone && c.phone.includes(search)));
    return sortDirection === "asc" ? filtered.sort((a, b) => a.serial - b.serial) : filtered.sort((a, b) => b.serial - a.serial);
  }, [customers, search, sortDirection]);

  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { data, error } = await supabase.from("customers").insert({
        name: values.name, phone: values.phone || null, address: values.address || null,
        created_by: user!.id,
        organization_id: (await supabase.from("users").select("organization_id").eq("auth_id", user!.id).single()).data?.organization_id,
      } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["customers"] }); toast({ title: "Customer created" }); closeDialog(); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: typeof form }) => {
      const { error } = await supabase.from("customers").update({ name: values.name, phone: values.phone || null, address: values.address || null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["customers"] }); toast({ title: "Customer updated" }); closeDialog(); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const softDeleteMutation = useMutation({
    mutationFn: async (customer: Customer) => {
      const { error } = await supabase.from("customers").update({ deleted_at: new Date().toISOString() }).eq("id", customer.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["customers"] }); toast({ title: "Customer deleted" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: async (customer: Customer) => {
      const { error } = await supabase.from("customers").update({ deleted_at: null }).eq("id", customer.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["customers"] }); toast({ title: "Customer restored" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm({ name: "", phone: "", address: "" }); setDialogOpen(true); };
  const openEdit = (c: Customer) => { setEditing(c); setForm({ name: c.name, phone: c.phone || "", address: c.address || "" }); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!form.name.trim()) return; if (editing) updateMutation.mutate({ id: editing.id, values: form }); else createMutation.mutate(form); };

  return (
    <div className="max-w-[1920px] mx-auto">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nexus-text-primary">Customers</h1>
          <p className="text-nexus-text-secondary">Manage your customer directory</p>
        </div>
        {canDelete && (
          <Button onClick={openCreate} className="bg-nexus-accent text-white shadow-lg shadow-nexus-accent/25 hover:bg-nexus-accent/90">
            <Plus className="mr-2 h-4 w-4" /> Add Customer
          </Button>
        )}
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nexus-text-secondary" />
        <Input placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 w-full bg-nexus-card border-nexus-border focus:ring-2 focus:ring-nexus-accent text-nexus-text-primary" />
      </div>

      <div className="bg-nexus-card rounded-2xl border border-nexus-border hover:shadow-lg transition-shadow">
        <div className="p-5 sm:p-6">
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={() => setShowDeleted(!showDeleted)} className={`border-nexus-border hover:bg-nexus-background ${showDeleted ? "border-nexus-danger text-nexus-danger" : "text-nexus-text-secondary"}`}>
              {showDeleted ? "Hide Deleted" : "Show Deleted"}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-nexus-accent border-t-transparent" /></div>
          ) : processedCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-nexus-text-secondary">
              <Users className="mb-4 h-12 w-12" /><p>No customers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-nexus-border">
                    <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold w-[60px]">#</TableHead>
                    <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold">Name</TableHead>
                    <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold">Phone</TableHead>
                    <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold">Address</TableHead>
                    <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold">Status</TableHead>
                    {(canDelete || canRestore) && <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedCustomers.map((c) => (
                    <TableRow key={c.id} className={`border-nexus-border hover:bg-nexus-background/50 ${c.deleted_at ? "opacity-60" : ""}`}>
                      <TableCell className="font-mono text-nexus-text-secondary font-semibold">{c.serial}</TableCell>
                      <TableCell className="font-medium text-nexus-text-primary">{c.name}</TableCell>
                      <TableCell className="text-nexus-text-primary">{c.phone || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-nexus-text-primary">{c.address || "—"}</TableCell>
                      <TableCell>
                        {c.deleted_at ? <Badge className="bg-nexus-danger/10 text-nexus-danger border border-nexus-danger/20">Deleted</Badge> : <Badge className="bg-nexus-success/10 text-nexus-success border border-nexus-success/20">Active</Badge>}
                      </TableCell>
                      {(canDelete || canRestore) && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {c.deleted_at ? (
                              canRestore && <Button size="icon" variant="ghost" onClick={() => restoreMutation.mutate(c)} className="hover:bg-nexus-background"><RotateCcw className="h-4 w-4" /></Button>
                            ) : (
                              canDelete && (
                                <>
                                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)} className="hover:bg-nexus-background"><Pencil className="h-4 w-4" /></Button>
                                  <Button size="icon" variant="ghost" onClick={() => softDeleteMutation.mutate(c)} className="text-nexus-danger hover:text-nexus-danger hover:bg-nexus-danger/10"><Trash2 className="h-4 w-4" /></Button>
                                </>
                              )
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-nexus-card border-nexus-border">
          <DialogHeader><DialogTitle className="text-nexus-text-primary">{editing ? "Edit Customer" : "New Customer"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-nexus-text-primary">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-nexus-background border-nexus-border text-nexus-text-primary" />
            </div>
            <div className="space-y-2">
              <Label className="text-nexus-text-primary">Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-nexus-background border-nexus-border text-nexus-text-primary" />
            </div>
            <div className="space-y-2">
              <Label className="text-nexus-text-primary">Address</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="bg-nexus-background border-nexus-border text-nexus-text-primary" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog} className="border-nexus-border hover:bg-nexus-background text-nexus-text-secondary">Cancel</Button>
              <Button type="submit" className="bg-nexus-accent text-white shadow-lg shadow-nexus-accent/25 hover:bg-nexus-accent/90" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
