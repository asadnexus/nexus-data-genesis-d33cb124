import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, RotateCcw, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GlassSearchBar } from "@/components/GlassSearchBar";
import type { Tables } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;

export default function Customers() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const canEdit = role === "main_admin" || role === "sub_admin";

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", showDeleted],
    queryFn: async () => {
      let query = supabase.from("customers").select("*").order("created_at", { ascending: false });
      if (!showDeleted) query = query.is("deleted_at", null);
      const { data, error } = await query;
      if (error) throw error;
      return data as Customer[];
    },
  });

  // Assign serial numbers based on creation order (oldest=1), then filter/sort
  const processedCustomers = useMemo(() => {
    // Sort by created_at ascending to assign serial numbers
    const sorted = [...customers].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const withSerial = sorted.map((c, i) => ({ ...c, serial: i + 1 }));

    // Filter by search (phone)
    const filtered = withSerial.filter(
      (c) =>
        (c.phone && c.phone.includes(search)) ||
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    // Sort by serial
    if (sortDirection === "desc") {
      filtered.sort((a, b) => b.serial - a.serial); // newest (highest serial) first
    } else {
      filtered.sort((a, b) => a.serial - b.serial); // oldest first
    }

    return filtered;
  }, [customers, search, sortDirection]);

  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { error } = await supabase.from("customers").insert({
        name: values.name,
        phone: values.phone || null,
        address: values.address || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Customer created" });
      closeDialog();
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: typeof form }) => {
      const { error } = await supabase.from("customers").update({
        name: values.name,
        phone: values.phone || null,
        address: values.address || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Customer updated" });
      closeDialog();
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const softDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Customer deleted" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").update({ deleted_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Customer restored" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm({ name: "", phone: "", address: "" }); setDialogOpen(true); };
  const openEdit = (c: Customer) => { setEditing(c); setForm({ name: c.name, phone: c.phone || "", address: c.address || "" }); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (editing) updateMutation.mutate({ id: editing.id, values: form });
    else createMutation.mutate(form);
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground">Manage your customer directory</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
            <Plus className="mr-2 h-4 w-4" /> Add Customer
          </Button>
        )}
      </div>

      {/* Glass Search Bar */}
      <div className="mb-6">
        <GlassSearchBar
          placeholder="Search by name or phone..."
          value={search}
          onChange={setSearch}
          sortOptions={[
            { label: "Serial #", value: "serial" },
          ]}
          sortValue="serial"
          sortDirection={sortDirection}
          onSortDirectionChange={setSortDirection}
        />
      </div>

      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex justify-end mb-4">
            <Button variant="outline" size="sm" onClick={() => setShowDeleted(!showDeleted)} className={showDeleted ? "border-destructive text-destructive" : ""}>
              {showDeleted ? "Hide Deleted" : "Show Deleted"}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-transparent" /></div>
          ) : processedCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="mb-4 h-12 w-12" /><p>No customers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Status</TableHead>
                    {canEdit && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedCustomers.map((c) => (
                    <TableRow key={c.id} className={c.deleted_at ? "opacity-60" : ""}>
                      <TableCell className="font-mono text-muted-foreground font-semibold">{c.serial}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.phone || "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{c.address || "—"}</TableCell>
                      <TableCell>
                        {c.deleted_at ? <Badge variant="destructive">Deleted</Badge> : <Badge className="bg-success text-success-foreground">Active</Badge>}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {c.deleted_at ? (
                              <Button size="icon" variant="ghost" onClick={() => restoreMutation.mutate(c.id)}><RotateCcw className="h-4 w-4" /></Button>
                            ) : (
                              <>
                                <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => softDeleteMutation.mutate(c.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                              </>
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-card">
          <DialogHeader><DialogTitle>{editing ? "Edit Customer" : "New Customer"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-background/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="bg-background/50 border-border" />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="bg-background/50 border-border" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" className="bg-secondary text-secondary-foreground hover:bg-secondary/90" disabled={createMutation.isPending || updateMutation.isPending}>
                {editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
