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
import { Plus, Pencil, Trash2, RotateCcw, Package, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

export default function Products() {
  const { user } = useAuth();
  const { permissions } = useMyPermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: "", price: "", stock: "", description: "" });
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const canEdit = permissions.can_edit_products;
  const canRestore = permissions.can_restore_deleted;

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", showDeleted],
    queryFn: async () => {
      let query = supabase.from("products").select("*").order("created_at", { ascending: false });
      if (!showDeleted) query = query.is("deleted_at", null);
      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
  });

  const processedProducts = useMemo(() => {
    const filtered = products.filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.code.toLowerCase().includes(search.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      if (sortBy === "stock") return sortDirection === "asc" ? a.stock - b.stock : b.stock - a.stock;
      if (sortBy === "code") return sortDirection === "asc" ? a.code.localeCompare(b.code) : b.code.localeCompare(a.code);
      return sortDirection === "asc"
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [products, search, sortBy, sortDirection]);

  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { data: code } = await supabase.rpc("generate_product_code");
      const { data: orgData } = await supabase.from("users").select("organization_id").eq("auth_id", user!.id).single();
      const { data, error } = await supabase.from("products").insert({
        code: code!, name: values.name, price: parseFloat(values.price) || 0,
        stock: parseInt(values.stock) || 0, description: values.description || null,
        created_by: user!.id, organization_id: orgData?.organization_id,
      } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast({ title: "Product created" }); closeDialog(); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: typeof form }) => {
      const { error } = await supabase.from("products").update({
        name: values.name, price: parseFloat(values.price) || 0,
        stock: parseInt(values.stock) || 0, description: values.description || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast({ title: "Product updated" }); closeDialog(); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const softDeleteMutation = useMutation({
    mutationFn: async (product: Product) => {
      const { error } = await supabase.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast({ title: "Product deleted" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: async (product: Product) => {
      const { error } = await supabase.from("products").update({ deleted_at: null }).eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast({ title: "Product restored" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm({ name: "", price: "", stock: "", description: "" }); setDialogOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setForm({ name: p.name, price: String(p.price), stock: String(p.stock), description: p.description || "" }); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!form.name.trim()) return; if (editing) updateMutation.mutate({ id: editing.id, values: form }); else createMutation.mutate(form); };

  return (
    <div className="max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nexus-text-primary">Products</h1>
          <p className="text-nexus-text-secondary">Manage your product inventory</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate} className="bg-nexus-accent text-white shadow-lg shadow-nexus-accent/25 hover:bg-nexus-accent/90">
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nexus-text-secondary" />
        <Input
          placeholder="Search by product name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 w-full bg-nexus-card border-nexus-border focus:ring-2 focus:ring-nexus-accent text-nexus-text-primary"
        />
      </div>

      {/* Card */}
      <div className="bg-nexus-card rounded-2xl border border-nexus-border hover:shadow-lg transition-shadow">
        <div className="p-5 sm:p-6">
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleted(!showDeleted)}
              className={`border-nexus-border hover:bg-nexus-background ${showDeleted ? "border-nexus-danger text-nexus-danger" : "text-nexus-text-secondary"}`}
            >
              {showDeleted ? "Hide Deleted" : "Show Deleted"}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-nexus-accent border-t-transparent" />
            </div>
          ) : processedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-nexus-text-secondary">
              <Package className="mb-4 h-12 w-12" />
              <p>No products found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-nexus-border">
                    <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold">Code</TableHead>
                    <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold">Name</TableHead>
                    <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold text-right">Price</TableHead>
                    <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold text-right">Stock</TableHead>
                    <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold">Status</TableHead>
                    {(canEdit || canRestore) && <TableHead className="bg-nexus-background text-xs uppercase text-nexus-text-secondary font-semibold text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedProducts.map((p) => (
                    <TableRow key={p.id} className={`border-nexus-border hover:bg-nexus-background/50 ${p.deleted_at ? "opacity-60" : ""}`}>
                      <TableCell className="font-mono text-sm text-nexus-text-primary">{p.code}</TableCell>
                      <TableCell className="font-medium text-nexus-text-primary">{p.name}</TableCell>
                      <TableCell className="text-right text-nexus-text-primary">৳{Number(p.price).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {p.stock <= 10 && !p.deleted_at ? (
                          <Badge className="bg-nexus-danger/10 text-nexus-danger border border-nexus-danger/20 text-xs">{p.stock}</Badge>
                        ) : (
                          <span className="text-nexus-text-primary">{p.stock}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {p.deleted_at ? (
                          <Badge className="bg-nexus-danger/10 text-nexus-danger border border-nexus-danger/20">Deleted</Badge>
                        ) : p.stock <= 10 ? (
                          <Badge className="bg-nexus-warning/10 text-nexus-warning border border-nexus-warning/20">Low Stock</Badge>
                        ) : (
                          <Badge className="bg-nexus-success/10 text-nexus-success border border-nexus-success/20">Active</Badge>
                        )}
                      </TableCell>
                      {(canEdit || canRestore) && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {p.deleted_at ? (
                              canRestore && (
                                <Button size="icon" variant="ghost" onClick={() => restoreMutation.mutate(p)} title="Restore" className="hover:bg-nexus-background">
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )
                            ) : (
                              canEdit && (
                                <>
                                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)} title="Edit" className="hover:bg-nexus-background">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => softDeleteMutation.mutate(p)} title="Delete" className="text-nexus-danger hover:text-nexus-danger hover:bg-nexus-danger/10">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
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

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-nexus-card border-nexus-border">
          <DialogHeader>
            <DialogTitle className="text-nexus-text-primary">{editing ? "Edit Product" : "New Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-nexus-text-primary">Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-nexus-background border-nexus-border text-nexus-text-primary" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-nexus-text-primary">Price (৳)</Label>
                <Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="bg-nexus-background border-nexus-border text-nexus-text-primary" />
              </div>
              <div className="space-y-2">
                <Label className="text-nexus-text-primary">Stock</Label>
                <Input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="bg-nexus-background border-nexus-border text-nexus-text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-nexus-text-primary">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-nexus-background border-nexus-border text-nexus-text-primary" />
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
