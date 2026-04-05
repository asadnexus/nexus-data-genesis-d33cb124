import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyPermissions } from "@/hooks/usePermissions";
import { usePhoneAutoFill } from "@/hooks/usePhoneAutoFill";
import { PhoneInput } from "@/components/PhoneInput";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, ShoppingCart, Trash2, Eye, Pencil, RotateCcw, Download, Printer, Share2, Link, Loader2, ChevronDown, Send, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { GlassSearchBar } from "@/components/GlassSearchBar";
import { InvoiceTemplate } from "@/components/InvoiceTemplate";
import { CustomerReceipt } from "@/components/CustomerReceipt";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useInvoiceSettings, defaultInvoiceSettings } from "@/hooks/useInvoiceSettings";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ORDER_STATUSES = ["New Order", "Individual · Order", "Bulk Sent · Pending", "Confirmed", "In Review", "Dispatched", "On Hold", "Delivered", "Delivered Approved", "Cancelled", "Returned"] as const;

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
  consignment_id: string | null;
  courier_name: string | null;
  created_at: string;
  deleted_at: string | null;
  invoice_url: string | null;
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
    case "New Order": return "bg-[#8B5CF6]/20 text-[#8B5CF6] border-[#8B5CF6]/30";
    case "Individual · Order": return "bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30 animate-pulse";
    case "Bulk Sent · Pending": return "bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30 animate-pulse";
    case "Confirmed": return "bg-[#3B82F6]/20 text-[#3B82F6] border-[#3B82F6]/30";
    case "In Review": return "bg-[#60A5FA]/20 text-[#60A5FA] border-[#60A5FA]/30";
    case "Dispatched": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "On Hold": return "bg-[#F97316]/20 text-[#F97316] border-[#F97316]/30";
    case "Delivered": return "bg-[#10B981]/20 text-[#10B981] border-[#10B981]/30";
    case "Delivered Approved": return "bg-[#059669]/20 text-[#059669] border-[#059669]/30";
    case "Cancelled": return "bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/30";
    case "Returned": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export default function Orders() {
  const { user } = useAuth();
  const { permissions } = useMyPermissions();
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { settings: companySettings } = useCompanySettings();
  const { settings: invoiceSettings } = useInvoiceSettings();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const customerReceiptRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOrder, setViewOrder] = useState<OrderRow | null>(null);
  const [viewItems, setViewItems] = useState<OrderItemRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [invoiceMode, setInvoiceMode] = useState(false);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [whatsappPdfUrl, setWhatsappPdfUrl] = useState("");
  const [whatsappGenerating, setWhatsappGenerating] = useState(false);

  // Send to courier state
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendOrder, setSendOrder] = useState<OrderRow | null>(null);
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const [sendCourierId, setSendCourierId] = useState("");
  const [sending, setSending] = useState(false);

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

  const canCreate = permissions.can_create_orders;
  const canDelete = permissions.can_delete_orders;
  const canRestore = permissions.can_restore_deleted;
  const canPrint = permissions.can_print_invoice;

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
        .select("id, name, is_active, api_key, secret_key, base_url")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      // Sort Steadfast first
      return (data || []).sort((a, b) => {
        const aS = a.name.toLowerCase().includes("steadfast") ? 0 : 1;
        const bS = b.name.toLowerCase().includes("steadfast") ? 0 : 1;
        return aS - bS;
      });
    },
  });

  // Phone auto-fill hook
  const phoneAutoFill = usePhoneAutoFill();

  // Trigger lookup when phone changes
  useEffect(() => {
    if (phone.length < 3) {
      setCustomerName("");
      setCustomerAddress("");
      setCustomerId(null);
      phoneAutoFill.clearSuggestions();
      return;
    }
    phoneAutoFill.lookupPhone(phone);
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
    onSuccess: (orderId) => {
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
      return editOrder;
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Order updated" });
      
      setEditOpen(false);
      setEditOrder(null);
      // Refresh view if open
      if (viewOrder && viewOrder.id === order.id) {
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
    mutationFn: async ({ id, status, invoice_code }: { id: string; status: string; invoice_code: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
      return { id, status, invoice_code };
    },
    onSuccess: ({ id, status, invoice_code }) => {
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
    mutationFn: async ({ id, invoice_code }: { id: string; invoice_code: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return { id, invoice_code };
    },
    onSuccess: ({ id, invoice_code }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Order deleted" });
      
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Restore order
  const restoreMutation = useMutation({
    mutationFn: async ({ id, invoice_code }: { id: string; invoice_code: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
      return { id, invoice_code };
    },
    onSuccess: ({ id, invoice_code }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Order restored" });
      
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Send to courier handler
  const handleSendToCourier = async (orderList: OrderRow[], isBulk: boolean) => {
    if (!sendCourierId) {
      toast({ title: "Select a courier", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("send-to-courier", {
        body: {
          courier_id: sendCourierId,
          orders: orderList.map((o) => ({
            order_id: o.id,
            invoice: o.invoice_code,
            recipient_name: o.customer_name,
            recipient_phone: o.customer_phone,
            recipient_address: o.customer_address || "",
            cod_amount: Number(o.cod),
            note: o.note || "",
          })),
        },
      });

      if (response.error) throw new Error(response.error.message);
      const result = response.data;

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        if (isBulk) {
          toast({ title: `Bulk send complete`, description: `${result.sent} sent, ${result.failed} failed` });
        } else {
          const first = result.results?.[0];
          if (first?.success) {
            toast({ title: "Order sent!", description: `Tracking: ${first.tracking_code}` });
          } else {
            toast({ title: "Send failed", description: first?.error || "Unknown error", variant: "destructive" });
          }
        }
      } else {
        toast({ title: "Send failed", description: result.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
      setSendDialogOpen(false);
      setBulkSendOpen(false);
      setSendOrder(null);
      setSendCourierId("");
    }
  };

  const pendingOrders = useMemo(() => orders.filter((o) => o.status === "Pending" && !o.deleted_at), [orders]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground">Manage orders and invoices</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canCreate && pendingOrders.length > 0 && (
            <Button
              onClick={() => { setSendCourierId(""); setBulkSendOpen(true); }}
              className="bg-[#4F46E5] hover:bg-[#4338CA] text-white"
            >
              <Package className="mr-2 h-4 w-4" /> Send Bulk ({pendingOrders.length})
            </Button>
          )}
          {canCreate && (
            <Button onClick={openCreate} className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
              <Plus className="mr-2 h-4 w-4" /> New Order
            </Button>
          )}
        </div>
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
                        {canCreate && !o.deleted_at ? (
                          <Select
                            value={o.status || "Pending"}
                            onValueChange={(v) => statusMutation.mutate({ id: o.id, status: v, invoice_code: o.invoice_code })}
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
                          {canCreate && !o.deleted_at && o.status === "Pending" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => { setSendOrder(o); setSendCourierId(""); setSendDialogOpen(true); }}
                              className="text-[#4F46E5] hover:text-[#4338CA]"
                              title="Send to courier"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => openViewOrder(o)} title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canCreate && !o.deleted_at && (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => openEdit(o)} title="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {canDelete && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => softDeleteMutation.mutate({ id: o.id, invoice_code: o.invoice_code })}
                                  className="text-destructive hover:text-destructive"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </>
                          )}
                          {canRestore && o.deleted_at && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => restoreMutation.mutate({ id: o.id, invoice_code: o.invoice_code })}
                              className="text-success hover:text-success/80"
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
                <PhoneInput
                  value={phone}
                  onChange={(val) => {
                    const cleaned = phoneAutoFill.onPhoneChange(val);
                    setPhone(cleaned);
                  }}
                  country={phoneAutoFill.country}
                  countries={phoneAutoFill.countries}
                  onCountryChange={phoneAutoFill.setCountry}
                  suggestions={phoneAutoFill.suggestions}
                  isSearching={phoneAutoFill.isSearching}
                  onSuggestionSelect={(c) => {
                    setCustomerName(c.name);
                    setCustomerAddress(c.address || "");
                    setCustomerId(c.id);
                    if (c.phone) setPhone(c.phone);
                    phoneAutoFill.clearSuggestions();
                  }}
                  onPhoneInput={phoneAutoFill.lookupPhone}
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
              {/* Thermal Receipt (visible) */}
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
                    invoice_url: viewOrder.invoice_url,
                    colors: invoiceSettings ? {
                      primary_color: invoiceSettings.primary_color,
                      secondary_color: invoiceSettings.secondary_color,
                      accent_color: invoiceSettings.accent_color,
                      text_color: invoiceSettings.text_color,
                      header_color: invoiceSettings.header_color,
                      border_color: invoiceSettings.border_color,
                      background_color: invoiceSettings.background_color,
                    } : undefined,
                    use_background_image: invoiceSettings?.use_background_image ?? false,
                  }}
                />
              </div>

              {/* Hidden Customer Receipt for download/print */}
              <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
                <CustomerReceipt
                  ref={customerReceiptRef}
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
                    invoice_url: viewOrder.invoice_url,
                    colors: invoiceSettings ? {
                      primary_color: invoiceSettings.primary_color,
                      secondary_color: invoiceSettings.secondary_color,
                      accent_color: invoiceSettings.accent_color,
                      text_color: invoiceSettings.text_color,
                      header_color: invoiceSettings.header_color,
                      border_color: invoiceSettings.border_color,
                      background_color: invoiceSettings.background_color,
                    } : undefined,
                    use_background_image: invoiceSettings?.use_background_image ?? false,
                  }}
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 justify-center flex-wrap">
                {/* Print Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Printer className="mr-1 h-4 w-4" /> Print <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => {
                      const content = invoiceRef.current;
                      if (!content) return;
                      const printWindow = window.open("", "_blank");
                      if (!printWindow) return;
                      printWindow.document.write(`<!DOCTYPE html><html><head><title>Invoice ${viewOrder.invoice_code}</title><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{width:80mm;margin:0 auto}@media print{@page{size:80mm auto;margin:0}body{width:80mm}}</style></head><body>${content.outerHTML}</body></html>`);
                      printWindow.document.close();
                      printWindow.onload = () => { printWindow.print(); };
                    }}>
                      <Printer className="mr-2 h-4 w-4" /> Thermal Print
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const content = customerReceiptRef.current;
                      if (!content) return;
                      const printWindow = window.open("", "_blank");
                      if (!printWindow) return;
                      printWindow.document.write(`<!DOCTYPE html><html><head><title>Invoice ${viewOrder.invoice_code}</title><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{width:210mm;margin:0 auto}@media print{@page{size:A4;margin:10mm}body{width:210mm}}</style></head><body>${content.outerHTML}</body></html>`);
                      printWindow.document.close();
                      printWindow.onload = () => { printWindow.print(); };
                    }}>
                      <Printer className="mr-2 h-4 w-4" /> Customer Print
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Download Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Download className="mr-1 h-4 w-4" /> Download <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => {
                      const content = invoiceRef.current;
                      if (!content) return;
                      const htmlStr = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${viewOrder.invoice_code}</title><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{width:80mm;margin:0 auto}@media print{@page{size:80mm auto;margin:0}body{width:80mm}}</style></head><body>${content.outerHTML}</body></html>`;
                      const blob = new Blob([htmlStr], { type: "text/html" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `thermal-${viewOrder.invoice_code}.html`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: "Thermal Receipt downloaded" });
                    }}>
                      <Download className="mr-2 h-4 w-4" /> Thermal Receipt
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const content = customerReceiptRef.current;
                      if (!content) return;
                      const htmlStr = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${viewOrder.invoice_code}</title><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{width:210mm;margin:0 auto}@media print{@page{size:A4;margin:10mm}body{width:210mm}}</style></head><body>${content.outerHTML}</body></html>`;
                      const blob = new Blob([htmlStr], { type: "text/html" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `invoice-${viewOrder.invoice_code}.html`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({ title: "Customer Receipt downloaded" });
                    }}>
                      <Download className="mr-2 h-4 w-4" /> Customer Receipt
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Share Link */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const content = customerReceiptRef.current;
                    if (!content) return;
                    const htmlStr = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice ${viewOrder.invoice_code}</title><link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;justify-content:center;min-height:100vh;background:#f5f5f5;padding:16px}@media print{@page{size:A4;margin:10mm}body{background:#fff;padding:0}}</style></head><body>${content.outerHTML}</body></html>`;
                    
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

                    await supabase.from("orders").update({ invoice_url: publicUrl }).eq("id", viewOrder.id);
                    await navigator.clipboard.writeText(publicUrl);
                    toast({ title: "Link copied!", description: "Shareable invoice link copied to clipboard" });
                  }}
                >
                  <Link className="mr-1 h-4 w-4" /> Share Link
                </Button>

                {/* WhatsApp Share - Sends PDF */}
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border-[#25D366]/30"
                  disabled={whatsappGenerating}
                  onClick={async () => {
                    const content = customerReceiptRef.current;
                    if (!content) return;

                    setWhatsappGenerating(true);
                    toast({ title: "Generating PDF...", description: "Please wait" });

                    try {
                      const html2pdf = (await import("html2pdf.js")).default;
                      const pdfBlob = await html2pdf()
                        .set({
                          margin: 10,
                          filename: `invoice-${viewOrder.invoice_code}.pdf`,
                          image: { type: "jpeg", quality: 0.98 },
                          html2canvas: { scale: 2, useCORS: true },
                          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
                        })
                        .from(content)
                        .outputPdf("blob");

                      const path = `${viewOrder.invoice_code}-${Date.now()}.pdf`;
                      const { error: uploadError } = await supabase.storage
                        .from("invoices")
                        .upload(path, pdfBlob, { upsert: true, contentType: "application/pdf" });

                      if (uploadError) {
                        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
                        return;
                      }

                      const { data: urlData } = supabase.storage.from("invoices").getPublicUrl(path);
                      const pdfUrl = urlData.publicUrl;

                      await supabase.from("orders").update({ invoice_url: pdfUrl }).eq("id", viewOrder.id);
                      setViewOrder({ ...viewOrder, invoice_url: pdfUrl });

                      const companyName = companySettings?.name || "Our Company";
                      const companyPhone = companySettings?.phone || "";
                      setWhatsappPdfUrl(pdfUrl);
                      setWhatsappMessage(
                        `${companyName}${companyPhone ? ` (${companyPhone})` : ""}\n\nAssalamu Alaikum, ${viewOrder.customer_name}!\n\nYour order #${viewOrder.invoice_code} has been processed.\n\nOrder Value: ৳${Number(viewOrder.order_value).toLocaleString()}\nAdvance: ৳${Number(viewOrder.advance).toLocaleString()}\nCOD: ৳${Number(viewOrder.cod).toLocaleString()}\n\nDownload your invoice: ${pdfUrl}\n\nThank you for shopping with us! 🙏`
                      );
                      setWhatsappDialogOpen(true);
                    } catch (err) {
                      console.error("PDF generation error:", err);
                      toast({ title: "PDF generation failed", description: "Could not generate invoice PDF", variant: "destructive" });
                    } finally {
                      setWhatsappGenerating(false);
                    }
                  }}
                >
                  {whatsappGenerating ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-1 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  )}
                  Send WhatsApp PDF
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

      {/* WhatsApp Message Dialog */}
      <Dialog open={whatsappDialogOpen} onOpenChange={setWhatsappDialogOpen}>
        <DialogContent className="bg-background border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <svg className="h-5 w-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Send via WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              To: <span className="font-medium text-foreground">{viewOrder?.customer_phone}</span>
              <span className="ml-2">({viewOrder?.customer_name})</span>
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={whatsappMessage}
                onChange={(e) => setWhatsappMessage(e.target.value)}
                rows={10}
                className="bg-background/50 border-border text-card-foreground text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setWhatsappDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
              onClick={() => {
                if (!viewOrder) return;
                const customerPhone = viewOrder.customer_phone.replace(/[^0-9+]/g, "").replace(/^\+/, "");
                const whatsappUrl = `https://wa.me/${customerPhone}?text=${encodeURIComponent(whatsappMessage)}`;
                window.open(whatsappUrl, "_blank");
                setWhatsappDialogOpen(false);
                toast({ title: "WhatsApp opened", description: "Message sent with invoice PDF link" });
              }}
            >
              <svg className="mr-1 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Open WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Send Modal */}
      <Dialog open={sendDialogOpen} onOpenChange={(open) => { setSendDialogOpen(open); if (!open) setSendOrder(null); }}>
        <DialogContent className="bg-background border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Send Order {sendOrder?.invoice_code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a courier to dispatch this order.
            </p>
            <div className="space-y-2">
              <Label>Courier</Label>
              <Select value={sendCourierId} onValueChange={setSendCourierId}>
                <SelectTrigger className="bg-background/50 border-border">
                  <SelectValue placeholder="Select courier" />
                </SelectTrigger>
                <SelectContent>
                  {couriers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.name.toLowerCase().includes("steadfast") ? "⭐" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {sendOrder && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{sendOrder.customer_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{sendOrder.customer_phone}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">COD</span><span>৳{Number(sendOrder.cod).toLocaleString()}</span></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#4F46E5] hover:bg-[#4338CA] text-white"
              disabled={sending || !sendCourierId}
              onClick={() => sendOrder && handleSendToCourier([sendOrder], false)}
            >
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Confirm Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Send Modal */}
      <Dialog open={bulkSendOpen} onOpenChange={setBulkSendOpen}>
        <DialogContent className="bg-background border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Send Bulk Orders</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{pendingOrders.length}</span> pending orders will be sent to the selected courier.
            </p>
            <div className="space-y-2">
              <Label>Courier</Label>
              <Select value={sendCourierId} onValueChange={setSendCourierId}>
                <SelectTrigger className="bg-background/50 border-border">
                  <SelectValue placeholder="Select courier" />
                </SelectTrigger>
                <SelectContent>
                  {couriers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.name.toLowerCase().includes("steadfast") ? "⭐" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkSendOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#4F46E5] hover:bg-[#4338CA] text-white"
              disabled={sending || !sendCourierId}
              onClick={() => handleSendToCourier(pendingOrders, true)}
            >
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
              Send {pendingOrders.length} Orders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
