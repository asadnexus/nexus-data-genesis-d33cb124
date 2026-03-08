import { useState, useEffect, useMemo, useRef } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, ShoppingCart, Trash2, Eye, Pencil, RotateCcw, Download, Printer, Share2, Link, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { GlassSearchBar } from "@/components/GlassSearchBar";
import { InvoiceTemplate } from "@/components/InvoiceTemplate";
import { useCompanySettings } from "@/hooks/useCompanySettings";

const ORDER_STATUSES = ["Pending", "Confirmed", "Dispatched", "Delivered", "Cancelled", "Returned"] as const;

interface OrderItem {
  product_id: string;
  quantity: number;
}

interface OrderRow {
  id: string;
  invoice_code: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  customer_id: string | null;
  courier_id: string | null;
  order_value: number;
  advance: number;
  total_due: number;
  cod: number;
  note: string | null;
  status: string | null;
  tracking_code: string | null;
  created_at: string;
  deleted_at: string | null;
  created_by: string;
}

interface OrderItemRow {
  id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

function statusColor(status: string | null): string {
  switch (status) {
    case "Confirmed": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "Dispatched": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "Delivered": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "Cancelled": return "bg-destructive/20 text-destructive border-destructive/30";
    case "Returned": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export default function Orders() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings: companySettings } = useCompanySettings();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState<OrderRow | null>(null);
  const [viewItems, setViewItems] = useState<OrderItemRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [invoiceMode, setInvoiceMode] = useState(false);

  // Order form state (create)
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [items, setItems] = useState<OrderItem[]>([{ product_id: "", quantity: 1 }]);
  const [advance, setAdvance] = useState("0");
  const [cod, setCod] = useState("0");
  const [note, setNote] = useState("");
  const [invoiceCode, setInvoiceCode] = useState("");
  const [selectedCourier, setSelectedCourier] = useState("");

  // Edit form state
  const [editOrder, setEditOrder] = useState<OrderRow | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editCustomerAddress, setEditCustomerAddress] = useState("");
  const [editAdvance, setEditAdvance] = useState("0");
  const [editCod, setEditCod] = useState("0");
  const [editNote, setEditNote] = useState("");
  const [editStatus, setEditStatus] = useState("Pending");
  const [editTrackingCode, setEditTrackingCode] = useState("");
  const [editCourier, setEditCourier] = useState("");

  const canEdit = role === "main_admin" || role === "sub_admin";

  // Fetch orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", showDeleted],
    queryFn: async () => {
      let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (!showDeleted) query = query.is("deleted_at", null);
      const { data, error } = await query;
      if (error) throw error;
      return data as OrderRow[];
    },
  });

  // Fetch products for the order form
  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, code, price, stock")
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch active couriers
  const { data: couriers = [] } = useQuery({
    queryKey: ["couriers-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("couriers")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Customer phone lookup (create form)
  useEffect(() => {
    if (phone.length < 3) {
      setCustomerName("");
      setCustomerAddress("");
      setCustomerId(null);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name, address")
        .eq("phone", phone)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      if (data) {
        setCustomerName(data.name);
        setCustomerAddress(data.address || "");
        setCustomerId(data.id);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [phone]);

  // Calculate order value from items
  const orderValue = useMemo(() => {
    return items.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) return sum;
      return sum + product.price * item.quantity;
    }, 0);
  }, [items, products]);

  const totalDue = orderValue - Number(advance || 0);

  // Auto-set COD to totalDue
  useEffect(() => {
    setCod(String(totalDue > 0 ? totalDue : 0));
  }, [totalDue]);

  // Edit form: auto-calculate total_due
  const editTotalDue = editOrder ? Number(editOrder.order_value) - Number(editAdvance || 0) : 0;

  useEffect(() => {
    setEditCod(String(editTotalDue > 0 ? editTotalDue : 0));
  }, [editTotalDue]);

  // Generate invoice code when dialog opens
  const generateCode = async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc("generate_invoice_code", { p_created_by: user.id });
    if (!error && data) setInvoiceCode(data);
  };

  const openCreate = () => {
    setPhone("");
    setCustomerName("");
    setCustomerAddress("");
    setCustomerId(null);
    setItems([{ product_id: "", quantity: 1 }]);
    setAdvance("0");
    setCod("0");
    setNote("");
    setInvoiceCode("");
    setSelectedCourier("");
    setDialogOpen(true);
    generateCode();
  };

  const openEdit = async (order: OrderRow) => {
    setEditOrder(order);
    setEditCustomerName(order.customer_name);
    setEditCustomerPhone(order.customer_phone);
    setEditCustomerAddress(order.customer_address || "");
    setEditAdvance(String(order.advance ?? 0));
    setEditCod(String(order.cod ?? 0));
    setEditNote(order.note || "");
    setEditStatus(order.status || "Pending");
    setEditTrackingCode(order.tracking_code || "");
    setEditCourier(order.courier_id || "");
    setEditOpen(true);
  };

  const filtered = useMemo(() => {
    const result = orders.filter(
      (o) =>
        o.invoice_code.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        o.customer_phone.includes(search)
    );
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "invoice") {
        cmp = a.invoice_code.localeCompare(b.invoice_code);
      } else {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return result;
  }, [orders, search, sortBy, sortDirection]);

  const addItem = () => setItems([...items, { product_id: "", quantity: 1 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof OrderItem, value: string | number) => {
    const updated = [...items];
    if (field === "quantity") updated[idx].quantity = Math.max(1, Number(value));
    else updated[idx].product_id = value as string;
    setItems(updated);
  };

  // Create order mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const validItems = items.filter((i) => i.product_id);
      if (!validItems.length) throw new Error("Add at least one product");
      if (!customerName.trim()) throw new Error("Customer name is required");
      if (!phone.trim()) throw new Error("Customer phone is required");

      const { data, error } = await supabase.rpc("create_order_with_items", {
        p_invoice_code: invoiceCode,
        p_customer_id: customerId,
        p_created_by: user!.id,
        p_customer_name: customerName.trim(),
        p_customer_phone: phone.trim(),
        p_customer_address: customerAddress.trim() || null,
        p_advance: Number(advance || 0),
        p_cod: Number(cod || 0),
        p_note: note.trim() || null,
        p_items: validItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-active"] });
      toast({ title: "Order created", description: `Invoice ${invoiceCode}` });
      setDialogOpen(false);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Edit order mutation
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editOrder) throw new Error("No order selected");
      const newAdvance = Number(editAdvance || 0);
      const newTotalDue = Number(editOrder.order_value) - newAdvance;

      const { error } = await supabase
        .from("orders")
        .update({
          customer_name: editCustomerName.trim(),
          customer_phone: editCustomerPhone.trim(),
          customer_address: editCustomerAddress.trim() || null,
          advance: newAdvance,
          total_due: newTotalDue > 0 ? newTotalDue : 0,
          cod: Number(editCod || 0),
          note: editNote.trim() || null,
          status: editStatus,
          tracking_code: editTrackingCode.trim() || null,
          courier_id: editCourier || null,
        })
        .eq("id", editOrder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Order updated" });
      setEditOpen(false);
      setEditOrder(null);
      // Refresh view if open
      if (viewOrder && viewOrder.id === editOrder?.id) {
        setViewOrder(null);
      }
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    editMutation.mutate();
  };

  // Quick status change
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Status updated" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // View order details
  const openViewOrder = async (order: OrderRow) => {
    setViewOrder(order);
    const { data } = await supabase
      .from("order_items")
      .select("id, product_name, product_code, quantity, unit_price, subtotal")
      .eq("order_id", order.id);
    setViewItems((data as OrderItemRow[]) || []);
  };

  // Soft delete order
  const softDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("orders")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Order deleted" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Restore order
  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("orders")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Order restored" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground">Manage orders and invoices</p>
        </div>
        {canEdit && (
          <Button onClick={openCreate} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
            <Plus className="mr-2 h-4 w-4" /> New Order
          </Button>
        )}
      </div>

      {/* Glass Search Bar */}
      <div className="mb-6">
        <GlassSearchBar
          placeholder="Search by invoice, name, or phone..."
          value={search}
          onChange={setSearch}
          sortOptions={[
            { label: "Date", value: "created_at" },
            { label: "Invoice", value: "invoice" },
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleted(!showDeleted)}
              className={showDeleted ? "border-destructive text-destructive" : ""}
            >
              {showDeleted ? "Hide Deleted" : "Show Deleted"}
            </Button>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShoppingCart className="mb-4 h-12 w-12" />
              <p>No orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Advance</TableHead>
                    <TableHead className="text-right">COD</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => (
                    <TableRow key={o.id} className={o.deleted_at ? "opacity-60" : ""}>
                      <TableCell className="font-mono font-medium">{o.invoice_code}</TableCell>
                      <TableCell>{o.customer_name}</TableCell>
                      <TableCell>{o.customer_phone}</TableCell>
                      <TableCell className="text-right">{Number(o.order_value).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(o.advance).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(o.cod).toLocaleString()}</TableCell>
                      <TableCell>
                        {canEdit && !o.deleted_at ? (
                          <Select
                            value={o.status || "Pending"}
                            onValueChange={(v) => statusMutation.mutate({ id: o.id, status: v })}
                          >
                            <SelectTrigger className={`h-7 w-[120px] text-xs border ${statusColor(o.status)}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ORDER_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={`${statusColor(o.status)} border`}>
                            {o.deleted_at ? "Deleted" : o.status || "Pending"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(o.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openViewOrder(o)} title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canEdit && !o.deleted_at && (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => openEdit(o)} title="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => softDeleteMutation.mutate(o.id)}
                                className="text-destructive hover:text-destructive"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {canEdit && o.deleted_at && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => restoreMutation.mutate(o.id)}
                              className="text-green-500 hover:text-green-400"
                              title="Restore"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Order Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-background border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Customer Section */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Customer phone"
                  required
                  className="bg-background/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Auto-filled from phone"
                  required
                  className="bg-background/50 border-border"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Auto-filled from phone"
                className="bg-background/50 border-border"
              />
            </div>

            <Separator />

            {/* Products Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Products</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="mr-1 h-3 w-3" /> Add Product
                </Button>
              </div>

              <div className="space-y-2">
                <div className="hidden sm:grid sm:grid-cols-[1fr_80px_80px_80px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
                  <span>Product</span>
                  <span>Qty</span>
                  <span>Price</span>
                  <span>Sub</span>
                  <span />
                </div>

                {items.map((item, idx) => {
                  const product = products.find((p) => p.id === item.product_id);
                  const subtotal = product ? product.price * item.quantity : 0;
                  return (
                    <div key={idx} className="grid grid-cols-[1fr_80px_80px_80px_40px] gap-2 items-center">
                      <Select value={item.product_id} onValueChange={(v) => updateItem(idx, "product_id", v)}>
                        <SelectTrigger className="bg-background/50 border-border text-sm">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.code} — {p.name} ({p.stock})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        max={product?.stock || 9999}
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                        className="bg-background/50 border-border text-sm"
                      />
                      <Input
                        readOnly
                        value={product ? product.price : "—"}
                        className="bg-muted/50 border-border text-sm text-muted-foreground"
                        tabIndex={-1}
                      />
                      <Input
                        readOnly
                        value={subtotal || "—"}
                        className="bg-muted/50 border-border text-sm text-muted-foreground"
                        tabIndex={-1}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Courier Selection */}
            {couriers.length > 0 && (
              <div className="space-y-2">
                <Label>Courier</Label>
                <Select value={selectedCourier} onValueChange={setSelectedCourier}>
                  <SelectTrigger className="bg-background/50 border-border">
                    <SelectValue placeholder="Select courier (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No courier</SelectItem>
                    {couriers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            {/* Order Summary */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order Value</span>
                  <span className="font-semibold">{orderValue.toLocaleString()}</span>
                </div>
                <div className="space-y-2">
                  <Label>Advance</Label>
                  <Input
                    type="number"
                    min={0}
                    value={advance}
                    onChange={(e) => setAdvance(e.target.value)}
                    className="bg-background/50 border-border"
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Due</span>
                  <span className="font-semibold">{totalDue.toLocaleString()}</span>
                </div>
                <div className="space-y-2">
                  <Label>COD</Label>
                  <Input
                    type="number"
                    min={0}
                    value={cod}
                    onChange={(e) => setCod(e.target.value)}
                    className="bg-background/50 border-border"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Note</Label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="bg-background/50 border-border"
                    rows={3}
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date</span>
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="font-mono font-semibold">{invoiceCode || "..."}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                disabled={createMutation.isPending}
              >
                Create Order →
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditOrder(null); }}>
        <DialogContent className="bg-background border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Order — {editOrder?.invoice_code}</DialogTitle>
          </DialogHeader>
          {editOrder && (
            <form onSubmit={handleEditSubmit} className="space-y-5">
              {/* Customer Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={editCustomerPhone}
                    onChange={(e) => setEditCustomerPhone(e.target.value)}
                    className="bg-background/50 border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    className="bg-background/50 border-border"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea
                  value={editCustomerAddress}
                  onChange={(e) => setEditCustomerAddress(e.target.value)}
                  className="bg-background/50 border-border"
                />
              </div>

              <Separator />

              {/* Status & Tracking */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="bg-background/50 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tracking Code</Label>
                  <Input
                    value={editTrackingCode}
                    onChange={(e) => setEditTrackingCode(e.target.value)}
                    placeholder="Courier tracking code"
                    className="bg-background/50 border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Courier</Label>
                  <Select value={editCourier} onValueChange={setEditCourier}>
                    <SelectTrigger className="bg-background/50 border-border">
                      <SelectValue placeholder="Select courier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No courier</SelectItem>
                      {couriers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Financial */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Order Value</span>
                    <span className="font-semibold">{Number(editOrder.order_value).toLocaleString()}</span>
                  </div>
                  <div className="space-y-2">
                    <Label>Advance</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editAdvance}
                      onChange={(e) => setEditAdvance(e.target.value)}
                      className="bg-background/50 border-border"
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Due</span>
                    <span className="font-semibold">{(editTotalDue > 0 ? editTotalDue : 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>COD</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editCod}
                      onChange={(e) => setEditCod(e.target.value)}
                      className="bg-background/50 border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Note</Label>
                    <Textarea
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      className="bg-background/50 border-border"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  disabled={editMutation.isPending}
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* View Order / Invoice Dialog */}
      <Dialog open={!!viewOrder} onOpenChange={() => { setViewOrder(null); setInvoiceMode(false); }}>
        <DialogContent className="bg-background border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center justify-between">
              <span>Order {viewOrder?.invoice_code}</span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={invoiceMode ? "secondary" : "outline"}
                  onClick={() => setInvoiceMode(!invoiceMode)}
                >
                  {invoiceMode ? "Details" : "Invoice"}
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          {viewOrder && !invoiceMode && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Customer</span>
                <span>{viewOrder.customer_name}</span>
                <span className="text-muted-foreground">Phone</span>
                <span>{viewOrder.customer_phone}</span>
                <span className="text-muted-foreground">Address</span>
                <span>{viewOrder.customer_address || "—"}</span>
                <span className="text-muted-foreground">Status</span>
                <Badge className={`${statusColor(viewOrder.status)} border w-fit`}>
                  {viewOrder.status || "Pending"}
                </Badge>
                {viewOrder.tracking_code && (
                  <>
                    <span className="text-muted-foreground">Tracking</span>
                    <span className="font-mono">{viewOrder.tracking_code}</span>
                  </>
                )}
                {viewOrder.courier_id && (
                  <>
                    <span className="text-muted-foreground">Courier</span>
                    <span>{couriers.find(c => c.id === viewOrder.courier_id)?.name || "—"}</span>
                  </>
                )}
              </div>

              <Separator />

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Sub</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">{item.product_code}</span>{" "}
                        {item.product_name}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{Number(item.unit_price).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Number(item.subtotal).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator />

              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Order Value</span>
                <span className="text-right font-semibold">{Number(viewOrder.order_value).toLocaleString()}</span>
                <span className="text-muted-foreground">Advance</span>
                <span className="text-right">{Number(viewOrder.advance).toLocaleString()}</span>
                <span className="text-muted-foreground">Total Due</span>
                <span className="text-right font-semibold">{Number(viewOrder.total_due).toLocaleString()}</span>
                <span className="text-muted-foreground">COD</span>
                <span className="text-right">{Number(viewOrder.cod).toLocaleString()}</span>
              </div>

              {viewOrder.note && (
                <>
                  <Separator />
                  <div>
                    <span className="text-xs text-muted-foreground">Note</span>
                    <p className="text-sm">{viewOrder.note}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {viewOrder && invoiceMode && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border overflow-hidden bg-white">
                <InvoiceTemplate
                  ref={invoiceRef}
                  data={{
                    invoice_code: viewOrder.invoice_code,
                    customer_name: viewOrder.customer_name,
                    customer_phone: viewOrder.customer_phone,
                    customer_address: viewOrder.customer_address,
                    order_value: viewOrder.order_value,
                    advance: Number(viewOrder.advance),
                    total_due: viewOrder.total_due,
                    cod: Number(viewOrder.cod),
                    note: viewOrder.note,
                    status: viewOrder.status,
                    created_at: viewOrder.created_at,
                    items: viewItems,
                    company: {
                      name: companySettings?.name || "",
                      logo_url: companySettings?.logo_url || "",
                      address: companySettings?.address || "",
                      phone: companySettings?.phone || "",
                      email: companySettings?.email || "",
                      website: companySettings?.website || "",
                    },
                  }}
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 justify-center flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const content = invoiceRef.current;
                    if (!content) return;
                    const printWindow = window.open("", "_blank");
                    if (!printWindow) return;
                    printWindow.document.write(`<!DOCTYPE html><html><head><title>Invoice ${viewOrder.invoice_code}</title><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{width:80mm;margin:0 auto}@media print{@page{size:80mm auto;margin:0}body{width:80mm}}</style></head><body>${content.outerHTML}</body></html>`);
                    printWindow.document.close();
                    printWindow.onload = () => { printWindow.print(); };
                  }}
                >
                  <Printer className="mr-1 h-4 w-4" /> Print
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const content = invoiceRef.current;
                    if (!content) return;
                    const htmlStr = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${viewOrder.invoice_code}</title><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{width:80mm;margin:0 auto}@media print{@page{size:80mm auto;margin:0}body{width:80mm}}</style></head><body>${content.outerHTML}</body></html>`;
                    const blob = new Blob([htmlStr], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `invoice-${viewOrder.invoice_code}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast({ title: "Invoice downloaded", description: "Open in browser → Print → Save as PDF" });
                  }}
                >
                  <Download className="mr-1 h-4 w-4" /> Download
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const content = invoiceRef.current;
                    if (!content) return;
                    const htmlStr = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ${viewOrder.invoice_code}</title><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;justify-content:center;min-height:100vh;background:#f5f5f5;padding:16px 0}@media print{@page{size:80mm auto;margin:0}body{background:#fff;padding:0}}</style></head><body>${content.outerHTML}</body></html>`;
                    
                    const path = `${viewOrder.invoice_code}-${Date.now()}.html`;
                    const blob = new Blob([htmlStr], { type: "text/html" });
                    const file = new File([blob], path, { type: "text/html" });

                    toast({ title: "Uploading invoice...", description: "Generating shareable link" });

                    const { error: uploadError } = await supabase.storage
                      .from("invoices")
                      .upload(path, file, { upsert: true, contentType: "text/html" });

                    if (uploadError) {
                      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
                      return;
                    }

                    const { data: urlData } = supabase.storage.from("invoices").getPublicUrl(path);
                    const publicUrl = urlData.publicUrl;

                    // Save invoice_url to order
                    await supabase.from("orders").update({ invoice_url: publicUrl }).eq("id", viewOrder.id);

                    // Copy to clipboard
                    await navigator.clipboard.writeText(publicUrl);
                    toast({ title: "Link copied!", description: "Shareable invoice link copied to clipboard" });
                  }}
                >
                  <Link className="mr-1 h-4 w-4" /> Share Link
                </Button>
              </div>

              {/* Show existing share link if available */}
              {viewOrder.invoice_url && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-xs">
                  <Link className="h-3 w-3 text-muted-foreground shrink-0" />
                  <a href={viewOrder.invoice_url} target="_blank" rel="noopener noreferrer" className="text-primary truncate hover:underline">
                    {viewOrder.invoice_url}
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(viewOrder.invoice_url!);
                      toast({ title: "Link copied!" });
                    }}
                  >
                    Copy
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
