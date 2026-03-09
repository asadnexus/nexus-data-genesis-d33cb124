import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyPermissions } from "@/hooks/usePermissions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, RotateCcw, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GlassSearchBar } from "@/components/GlassSearchBar";
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
      if (sortBy === "stock") {
        return sortDirection === "asc" ? a.stock - b.stock : b.stock - a.stock;
      }
      if (sortBy === "code") {
        return sortDirection === "asc" ? a.code.localeCompare(b.code) : b.code.localeCompare(a.code);
      }
      // Default: created_at
      return sortDirection === "asc"
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [products, search, sortBy, sortDirection]);

  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { data: code } = await supabase.rpc("generate_product_code");
      const { data, error } = await supabase.from("products").insert({
        code: code!,
        name: values.name,
        price: parseFloat(values.price) || 0,
        stock: parseInt(values.stock) || 0,
        description: values.description || null,
        created_by: user!.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Product created" });
      
      closeDialog();
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: typeof form }) => {
      const { error } = await supabase.from("products").update({
        name: values.name,
        price: parseFloat(values.price) || 0,
        stock: parseInt(values.stock) || 0,
        description: values.description || null,
      }).eq("id", id);
      if (error) throw error;
      return { id, values };
    },
    onSuccess: ({ id, values }) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Product updated" });
      log("updated", "product", id, { name: values.name });
      closeDialog();
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const softDeleteMutation = useMutation({
    mutationFn: async (product: Product) => {
      const { error } = await supabase.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", product.id);
      if (error) throw error;
      return product;
    },
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Product deleted" });
      log("deleted", "product", product.id, { name: product.name, code: product.code });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: async (product: Product) => {
      const { error } = await supabase.from("products").update({ deleted_at: null }).eq("id", product.id);
      if (error) throw error;
      return product;
    },
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Product restored" });
      log("restored", "product", product.id, { name: product.name, code: product.code });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", price: "", stock: "", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, price: String(p.price), stock: String(p.stock), description: p.description || "" });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

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
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground">Manage your product inventory</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        )}
      </div>

      <div className="mb-6">
        <GlassSearchBar
          placeholder="Search by product name or code..."
          value={search}
          onChange={setSearch}
          sortOptions={[
            { label: "Date", value: "created_at" },
            { label: "Stock", value: "stock" },
            { label: "Code", value: "code" },
          ]}
          sortValue={sortBy}
          sortDirection={sortDirection}
          onSortChange={setSortBy}
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
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-transparent" />
            </div>
          ) : processedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="mb-4 h-12 w-12" />
              <p>No products found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Status</TableHead>
                    {(canEdit || canRestore) && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedProducts.map((p) => (
                    <TableRow key={p.id} className={p.deleted_at ? "opacity-60" : ""}>
                      <TableCell className="font-mono text-sm">{p.code}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">৳{Number(p.price).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {p.stock <= 10 && !p.deleted_at ? (
                          <Badge variant="destructive" className="text-xs">{p.stock}</Badge>
                        ) : (
                          p.stock
                        )}
                      </TableCell>
                      <TableCell>
                        {p.deleted_at ? (
                          <Badge variant="destructive">Deleted</Badge>
                        ) : p.stock <= 10 ? (
                          <Badge className="bg-warning text-warning-foreground">Low Stock</Badge>
                        ) : (
                          <Badge className="bg-success text-success-foreground">Active</Badge>
                        )}
                      </TableCell>
                      {(canEdit || canRestore) && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {p.deleted_at ? (
                              canRestore && (
                                <Button size="icon" variant="ghost" onClick={() => restoreMutation.mutate(p)} title="Restore">
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )
                            ) : (
                              canEdit && (
                                <>
                                  <Button size="icon" variant="ghost" onClick={() => openEdit(p)} title="Edit">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => softDeleteMutation.mutate(p)} title="Delete" className="text-destructive hover:text-destructive">
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-background border-border">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "New Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-background/50 border-border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price (৳)</Label>
                <Input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="bg-background/50 border-border" />
              </div>
              <div className="space-y-2">
                <Label>Stock</Label>
                <Input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="bg-background/50 border-border" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-background/50 border-border" />
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
